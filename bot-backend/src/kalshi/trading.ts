import { KalshiClient } from "./client";
import { PriceCache } from "./priceCache";
import { Config } from "../config";
import { TradeResult } from "../polymarket/trading";
import { createLogger } from "../logger";

const log = createLogger("KalshiTrading");

// Module-level price cache — set via setPriceCache() from index.ts.
// When populated, buy/sell skip the REST orderbook fetch entirely.
let priceCache: PriceCache | null = null;

export function setPriceCache(cache: PriceCache): void {
  priceCache = cache;
}

// ============================================================
// Constants
// ============================================================

/** Kalshi taker fee: $0.02 per contract (2% of $1 max payout). */
const TAKER_FEE_PER_CONTRACT = 0.02;

// ============================================================
// Helpers
// ============================================================

function parseTradeId(tradeId: string): { ticker: string; side: "yes" | "no" } {
  const sep = tradeId.lastIndexOf("::");
  if (sep !== -1) {
    const raw = tradeId.slice(sep + 2).toUpperCase();
    return { ticker: tradeId.slice(0, sep), side: raw === "NO" ? "no" : "yes" };
  }
  return { ticker: tradeId, side: "yes" };
}

/**
 * Extract actual average fill price (dollars) and total fees (dollars) from
 * a Kalshi Order response using the official Order fields:
 *   - taker_fill_cost / maker_fill_cost  — fill cost in cents
 *   - taker_fees / maker_fees            — fees in cents
 *   - fill_count                          — number of contracts filled
 *
 * IMPORTANT — Kalshi's fill cost direction:
 *   BUY  orders: taker_fill_cost is in the bought side's cents.
 *                avgPrice = taker_fill_cost / count / 100
 *   SELL orders: taker_fill_cost is in the OPPOSITE side's cents.
 *                e.g. selling YES at 18¢ → taker_fill_cost = 82¢×count (NO cents).
 *                avgPrice = 1 - taker_fill_cost / count / 100
 *
 * Falls back to limitCents if fill_count = 0 (unfilled GTC sitting on book).
 * Falls back to TAKER_FEE_PER_CONTRACT estimate if the API returns no fee data.
 */
function extractFillData(
  order: any,
  limitCents: number,
  action: "buy" | "sell",
): { avgPriceDollars: number; feeDollars: number } {
  const fillCount = Number(order.fill_count ?? 0);
  const totalFillCostCents =
    Number(order.taker_fill_cost ?? 0) + Number(order.maker_fill_cost ?? 0);
  const totalFeesCents =
    Number(order.taker_fees ?? 0) + Number(order.maker_fees ?? 0);

  let avgPriceDollars: number;
  if (fillCount > 0 && totalFillCostCents > 0) {
    const rawCost = totalFillCostCents / fillCount / 100;
    // Sell orders: fill cost is denominated in the complement side — invert to get the sell price.
    avgPriceDollars = action === "sell" ? 1 - rawCost : rawCost;
  } else {
    avgPriceDollars = limitCents / 100;
  }

  const feeDollars =
    totalFeesCents > 0
      ? totalFeesCents / 100
      : fillCount > 0
      ? fillCount * TAKER_FEE_PER_CONTRACT // fallback estimate if API omits fees
      : 0;

  return { avgPriceDollars, feeDollars };
}

/**
 * Best ask price in cents.
 * 1. Try live WebSocket cache (zero extra latency).
 * 2. Fall back to REST orderbook if cache is empty/stale.
 */
async function resolveAskCents(
  client: KalshiClient,
  ticker: string,
  side: "yes" | "no",
): Promise<number | null> {
  const cached = priceCache?.getBestAskCents(ticker, side);
  if (cached !== null && cached !== undefined) {
    log.debug(`[cache] ask ${ticker} ${side.toUpperCase()} = ${cached}¢`);
    return cached;
  }
  log.debug(`[cache miss] fetching ask via REST for ${ticker}`);
  return fetchAskCentsREST(client, ticker, side);
}

async function fetchAskCentsREST(
  client: KalshiClient,
  ticker: string,
  side: "yes" | "no",
): Promise<number | null> {
  const obResp = await client.markets.getMarketOrderbook(ticker, 1);
  const ob = obResp.data.orderbook;
  if (side === "yes") {
    const d = ob.no_dollars?.[0]?.[0];
    return d ? Math.round((1 - parseFloat(d)) * 100) : null;
  }
  const d = ob.yes_dollars?.[0]?.[0];
  return d ? Math.round((1 - parseFloat(d)) * 100) : null;
}

/**
 * Best bid price in cents.
 * Same cache-first, REST-fallback pattern.
 */
async function resolveBidCents(
  client: KalshiClient,
  ticker: string,
  side: "yes" | "no",
): Promise<number | null> {
  const cached = priceCache?.getBestBidCents(ticker, side);
  if (cached !== null && cached !== undefined) {
    log.debug(`[cache] bid ${ticker} ${side.toUpperCase()} = ${cached}¢`);
    return cached;
  }
  log.debug(`[cache miss] fetching bid via REST for ${ticker}`);
  return fetchBidCentsREST(client, ticker, side);
}

async function fetchBidCentsREST(
  client: KalshiClient,
  ticker: string,
  side: "yes" | "no",
): Promise<number | null> {
  const obResp = await client.markets.getMarketOrderbook(ticker, 1);
  const ob = obResp.data.orderbook;
  if (side === "yes") {
    const d = ob.yes_dollars?.[0]?.[0];
    return d ? Math.round(parseFloat(d) * 100) : null;
  }
  const d = ob.no_dollars?.[0]?.[0];
  return d ? Math.round(parseFloat(d) * 100) : null;
}

// ============================================================
// Buy  (FOK limit, GTC fallback)
// ============================================================

export async function executeBuy(
  client: KalshiClient,
  config: Config,
  tradeId: string,
  usdcAmount?: number,
): Promise<TradeResult> {
  const t0 = Date.now();
  const amount = usdcAmount ?? config.defaultBuySize;
  const { ticker, side } = parseTradeId(tradeId);

  log.info(`BUY  ticker=${ticker}  side=${side}  amount=$${amount}`);

  try {
    const bestAskCents = await resolveAskCents(client, ticker, side);
    if (!bestAskCents || bestAskCents <= 0 || bestAskCents >= 100) {
      return fail(`No liquidity for ${side.toUpperCase()} side (ask=${bestAskCents}¢)`, t0);
    }

    const count = Math.floor((amount * 100) / bestAskCents);
    if (count <= 0) {
      return fail(`Buy amount $${amount} too small for ask ${bestAskCents}¢`, t0);
    }

    const priceMs = Date.now() - t0;
    log.info(`FOK BUY  side=${side}  count=${count}  ask=${bestAskCents}¢  (price resolved in ${priceMs}ms)`);

    const priceField = side === "yes" ? { yes_price: bestAskCents } : { no_price: bestAskCents };
    const resp = await client.orders.createOrder({
      ticker,
      side,
      action: "buy",
      count,
      type: "limit",
      ...priceField,
      time_in_force: "fill_or_kill",
    });

    const order = resp.data.order;
    const latencyMs = Date.now() - t0;
    const filledCount = order.fill_count ?? 0;

    if (filledCount === 0) {
      log.warn("FOK not filled — falling back to GTC limit order");
      return executeGTCBuy(client, ticker, side, amount, bestAskCents, t0);
    }

    const { avgPriceDollars: fillPrice, feeDollars: fee } = extractFillData(order, bestAskCents, "buy");
    log.info(`BUY filled  orderId=${order.order_id}  avgPrice=${fillPrice.toFixed(4)}  contracts=${filledCount}  fee=$${fee.toFixed(2)}  latency=${latencyMs}ms`);
    return { success: true, orderId: order.order_id, price: fillPrice, size: filledCount, fee, latencyMs };
  } catch (err) {
    log.warn(`FOK buy failed: ${errMsg(err)} — falling back to GTC`);
    return executeGTCBuy(client, ticker, side, amount, undefined, t0);
  }
}

async function executeGTCBuy(
  client: KalshiClient,
  ticker: string,
  side: "yes" | "no",
  amount: number,
  bestAskCents: number | undefined,
  t0: number,
): Promise<TradeResult> {
  try {
    if (!bestAskCents) {
      const cents = await resolveAskCents(client, ticker, side);
      if (!cents || cents <= 0 || cents >= 100) {
        return fail(`No liquidity for ${side.toUpperCase()} (GTC fallback)`, t0);
      }
      bestAskCents = cents;
    }

    const count = Math.floor((amount * 100) / bestAskCents);
    if (count <= 0) return fail(`Amount $${amount} too small for ask ${bestAskCents}¢ (GTC)`, t0);

    const priceField = side === "yes" ? { yes_price: bestAskCents } : { no_price: bestAskCents };
    const resp = await client.orders.createOrder({
      ticker,
      side,
      action: "buy",
      count,
      type: "limit",
      ...priceField,
      time_in_force: "good_till_canceled",
    });

    const order = resp.data.order;
    const latencyMs = Date.now() - t0;
    const { avgPriceDollars: fillPrice, feeDollars: fillFee } = extractFillData(order, bestAskCents, "buy");
    // If GTC is sitting on the book (nothing filled yet), estimate fee for bookkeeping.
    const fee = fillFee > 0 ? fillFee : count * TAKER_FEE_PER_CONTRACT;
    log.info(`GTC BUY posted  orderId=${order.order_id}  price=${fillPrice.toFixed(4)}  count=${count}  fee=$${fee.toFixed(2)}  latency=${latencyMs}ms`);
    return { success: true, orderId: order.order_id, price: fillPrice, size: count, fee, latencyMs };
  } catch (err) {
    return fail(errMsg(err), t0);
  }
}

// ============================================================
// Sell  (manual — user-triggered)
// ============================================================

export async function executeSell(
  client: KalshiClient,
  config: Config,
  tradeId: string,
  size: number,
  price?: number,
): Promise<TradeResult> {
  const t0 = Date.now();
  const { ticker, side } = parseTradeId(tradeId);

  // size=0 means "sell all" — fetch actual position from API
  if (size === 0) {
    try {
      const posResp = await client.portfolio.getPositions(undefined, undefined, undefined, ticker);
      const pos = posResp.data.market_positions.find((p) => p.ticker === ticker);
      if (!pos || pos.position === 0) return fail("No open position found in account", t0);
      size = Math.abs(pos.position);
      log.info(`SELL ALL (from API) — ticker=${ticker}  side=${side}  contracts=${size}`);
    } catch (err) {
      return fail(`Failed to fetch position: ${errMsg(err)}`, t0);
    }
  }

  try {
    let sellPriceCents: number;

    if (price !== undefined) {
      sellPriceCents = Math.round(price * 100);
    } else {
      const bidCents = await resolveBidCents(client, ticker, side);
      if (bidCents && bidCents > 0) {
        sellPriceCents = bidCents;
        log.info(`Best ${side.toUpperCase()} bid: ${sellPriceCents}¢`);
      } else {
        sellPriceCents = 1;
        log.warn(`No ${side.toUpperCase()} bid found — selling at 1¢`);
      }
    }

    log.info(`SELL  ticker=${ticker}  side=${side}  contracts=${size}  price=${sellPriceCents}¢`);

    const priceField = side === "yes" ? { yes_price: sellPriceCents } : { no_price: sellPriceCents };
    const resp = await client.orders.createOrder({
      ticker,
      side,
      action: "sell",
      count: size,
      type: "limit",
      ...priceField,
      time_in_force: "good_till_canceled",
    });

    const order = resp.data.order;
    const latencyMs = Date.now() - t0;
    const { avgPriceDollars: fillPrice, feeDollars: fee } = extractFillData(order, sellPriceCents, "sell");
    log.info(`SELL posted  orderId=${order.order_id}  price=${fillPrice.toFixed(4)}  contracts=${size}  fee=$${fee.toFixed(2)}  latency=${latencyMs}ms`);
    return { success: true, orderId: order.order_id, price: fillPrice, size, fee, latencyMs };
  } catch (err) {
    return fail(errMsg(err), t0);
  }
}

/**
 * Extract a human-readable error message from an Axios error,
 * including the response body so Kalshi's reason is visible in the logs.
 */
function errMsg(err: unknown): string {
  if (err != null && typeof err === "object" && "response" in err) {
    const axiosErr = err as { response?: { data?: unknown; status?: number }; message?: string };
    const status = axiosErr.response?.status ?? "?";
    const body = axiosErr.response?.data;
    const bodyStr = body
      ? typeof body === "string"
        ? body
        : JSON.stringify(body)
      : "";
    return `HTTP ${status}${bodyStr ? " — " + bodyStr : ""}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function fail(error: string, t0: number): TradeResult {
  log.error(error);
  return { success: false, error, latencyMs: Date.now() - t0 };
}
