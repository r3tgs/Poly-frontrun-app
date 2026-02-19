import { PolymarketUSClient } from "./client";
import { Config } from "../config";
import { TradeResult } from "../polymarket/trading";
import { createLogger } from "../logger";

const log = createLogger("PolyUSTrading");

// ============================================================
// Helpers
// ============================================================

/**
 * Parse the composite trade ID produced by ws/server.ts getTradeId().
 * Format: "<marketSlug>::<LONG|SHORT>"
 */
function parseTradeId(tradeId: string): { marketSlug: string; intent: "LONG" | "SHORT" } {
  const sep = tradeId.lastIndexOf("::");
  if (sep !== -1) {
    const intent = tradeId.slice(sep + 2) as "LONG" | "SHORT";
    return { marketSlug: tradeId.slice(0, sep), intent };
  }
  return { marketSlug: tradeId, intent: "LONG" };
}

// ============================================================
// Buy  (market order — fastest execution)
// ============================================================

/**
 * Execute a market buy on Polymarket US.
 *
 * `tradeId` format: "<marketSlug>::<LONG|SHORT>"
 *   LONG  — buy YES / home-team-wins position
 *   SHORT — buy NO  / away-team-wins position (sports moneyline)
 *
 * Fast path: market order with synchronous execution (FOK-style).
 * Fallback: limit order at the best ask price.
 */
export async function executeBuy(
  client: PolymarketUSClient,
  config: Config,
  tradeId: string,
  usdcAmount?: number,
): Promise<TradeResult> {
  const t0 = Date.now();
  const amount = usdcAmount ?? config.defaultBuySize;
  const { marketSlug, intent } = parseTradeId(tradeId);
  const buyIntent = intent === "SHORT" ? "ORDER_INTENT_BUY_SHORT" : "ORDER_INTENT_BUY_LONG";

  log.info(`BUY  slug=${marketSlug}  intent=${intent}  amount=$${amount}`);

  try {
    // Fast path: market order, synchronous execution
    const resp = await client.api.orders.create({
      marketSlug,
      intent: buyIntent,
      type: "ORDER_TYPE_MARKET",
      cashOrderQty: { value: String(amount), currency: "USD" },
      tif: "TIME_IN_FORCE_FILL_OR_KILL",
      synchronousExecution: true,
    });

    const latencyMs = Date.now() - t0;
    const executions = resp.executions ?? [];

    // Check for rejection
    const rejected = executions.find((e) => e.type === "EXECUTION_TYPE_REJECTED");
    if (rejected && !executions.find((e) => e.type === "EXECUTION_TYPE_FILL" || e.type === "EXECUTION_TYPE_PARTIAL_FILL")) {
      const reason = rejected.orderRejectReason ?? "unknown";
      log.warn(`Market order rejected (${reason}) — falling back to limit order at best ask`);
      return executeLimitBuy(client, marketSlug, buyIntent, amount, t0);
    }

    // Find the fill execution (not the ack)
    const fillExec = executions.find(
      (e) => e.type === "EXECUTION_TYPE_FILL" || e.type === "EXECUTION_TYPE_PARTIAL_FILL",
    ) ?? executions[executions.length - 1];

    // avgPx is the average fill price; lastPx is often 0 for cash/market orders
    const avgPx = parseFloat((fillExec?.order?.avgPx as any)?.value ?? "0");
    const fillPrice = avgPx > 0 ? avgPx : undefined;

    // cumQuantity is actual contracts filled; fallback to dollar amount
    const fillSize = (fillExec?.order?.cumQuantity ?? 0) > 0
      ? fillExec!.order.cumQuantity
      : amount;

    log.info(`BUY filled  orderId=${resp.id}  price=${fillPrice ?? "unknown"}  contracts=${fillSize}  latency=${latencyMs}ms`);
    return { success: true, orderId: resp.id, price: fillPrice, size: fillSize, latencyMs };
  } catch (_err) {
    // Fallback: limit order at best ask
    log.warn("Market order failed — falling back to limit order at best ask");
    return executeLimitBuy(client, marketSlug, buyIntent, amount, t0);
  }
}

async function executeLimitBuy(
  client: PolymarketUSClient,
  marketSlug: string,
  buyIntent: "ORDER_INTENT_BUY_LONG" | "ORDER_INTENT_BUY_SHORT",
  usdcAmount: number,
  t0: number,
): Promise<TradeResult> {
  try {
    const bbo = await client.api.markets.bbo(marketSlug);

    if (!bbo.bestAsk?.value) {
      return fail("No ask available in order book", t0);
    }

    const bestAsk = parseFloat(bbo.bestAsk.value);
    const shares = Math.floor(usdcAmount / bestAsk);

    if (shares <= 0) {
      return fail(
        `Buy amount $${usdcAmount} too small for ask price ${bestAsk}`,
        t0,
      );
    }

    log.info(`Limit BUY  ask=${bestAsk}  shares=${shares}`);

    const resp = await client.api.orders.create({
      marketSlug,
      intent: buyIntent,
      type: "ORDER_TYPE_LIMIT",
      price: { value: String(bestAsk), currency: "USD" },
      quantity: shares,
      tif: "TIME_IN_FORCE_GOOD_TILL_CANCEL",
    });

    const latencyMs = Date.now() - t0;
    log.info(`Limit BUY posted  orderId=${resp.id}  latency=${latencyMs}ms`);
    return { success: true, orderId: resp.id, price: bestAsk, size: shares, latencyMs };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), t0);
  }
}

// ============================================================
// Sell  (manual — user-triggered)
// ============================================================

/**
 * Execute a manual sell on Polymarket US.
 *
 * If `price` is omitted, fetches the current best bid and sells at that price.
 * `size` = number of shares to sell.
 */
export async function executeSell(
  client: PolymarketUSClient,
  config: Config,
  tradeId: string,
  size: number,
  price?: number,
): Promise<TradeResult> {
  const t0 = Date.now();
  const { marketSlug, intent } = parseTradeId(tradeId);
  const sellIntent = intent === "SHORT" ? "ORDER_INTENT_SELL_SHORT" : "ORDER_INTENT_SELL_LONG";

  // size=0 means "sell all" — look up actual position from the API
  if (size === 0) {
    try {
      const posResp = await client.api.portfolio.positions({ market: marketSlug });
      const pos = posResp.positions[marketSlug] ?? Object.values(posResp.positions)[0];
      const actualSize = Math.round(parseFloat(pos?.qtyAvailable ?? pos?.netPosition ?? "0"));
      if (actualSize <= 0) {
        return fail("No open position found in account", t0);
      }
      log.info(`SELL ALL (from API) — slug=${marketSlug}  contracts=${actualSize}`);
      size = actualSize;
    } catch (err) {
      return fail(`Failed to fetch position: ${err instanceof Error ? err.message : String(err)}`, t0);
    }
  }

  try {
    let sellPrice = price;
    if (sellPrice === undefined) {
      const bbo = await client.api.markets.bbo(marketSlug);
      if (bbo.bestBid?.value) {
        sellPrice = parseFloat(bbo.bestBid.value);
        log.info(`Best bid: ${sellPrice}`);
      } else if (bbo.bestAsk?.value) {
        // No bid — use a price just below the best ask to cross the spread
        sellPrice = Math.max(0.01, parseFloat(bbo.bestAsk.value) - 0.01);
        log.warn(`No bid — selling at ${sellPrice} (below best ask)`);
      } else {
        // No liquidity at all — try a market sell at minimum price
        sellPrice = 0.01;
        log.warn("No bid or ask — attempting market sell at $0.01");
      }
    }

    log.info(`SELL  slug=${marketSlug}  intent=${intent}  shares=${size}  price=${sellPrice}`);

    const resp = await client.api.orders.create({
      marketSlug,
      intent: sellIntent,
      type: "ORDER_TYPE_LIMIT",
      price: { value: String(sellPrice), currency: "USD" },
      quantity: size,
      tif: "TIME_IN_FORCE_GOOD_TILL_CANCEL",
    });

    const latencyMs = Date.now() - t0;
    log.info(`SELL posted  orderId=${resp.id}  latency=${latencyMs}ms`);
    return { success: true, orderId: resp.id, price: sellPrice, size, latencyMs };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), t0);
  }
}

function fail(error: string, t0: number): TradeResult {
  log.error(error);
  return { success: false, error, latencyMs: Date.now() - t0 };
}
