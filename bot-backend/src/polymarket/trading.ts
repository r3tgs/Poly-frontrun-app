import { Side, OrderType } from "@polymarket/clob-client";
import { PolymarketClient } from "./client";
import { Config } from "../config";
import { createLogger } from "../logger";

const log = createLogger("Trading");

// ============================================================
// Types
// ============================================================

export interface TradeResult {
  success: boolean;
  orderId?: string;
  price?: number;
  /** Number of contracts (limit) or USDC amount (market) */
  size?: number;
  error?: string;
  /** Milliseconds from function entry to order post */
  latencyMs: number;
}

// ============================================================
// Buy  (market order — fastest execution)
// ============================================================

/**
 * Execute a market buy using `createAndPostMarketOrder` with FOK.
 *
 * This is the fastest path: the CLOB resolves the best available
 * price on the server side, so we skip the orderbook round-trip.
 *
 * Falls back to a limit order at the best ask if the market order
 * path fails (e.g., insufficient liquidity for FOK).
 */
export async function executeBuy(
  client: PolymarketClient,
  config: Config,
  tokenId: string,
  usdcAmount?: number,
): Promise<TradeResult> {
  const t0 = Date.now();
  const amount = usdcAmount ?? config.defaultBuySize;

  try {
    log.info(`BUY  token=${tokenId}  amount=${amount} USDC`);

    // --- fast path: market order (FOK) ---------------------------
    const resp = await client.clob.createAndPostMarketOrder({
      tokenID: tokenId,
      amount,
      side: Side.BUY,
    });

    const latencyMs = Date.now() - t0;

    if (!resp.success) {
      log.warn(`Market order rejected: ${resp.errorMsg}`);
      return {
        success: false,
        orderId: resp.orderID,
        error: resp.errorMsg || "Market order rejected",
        latencyMs,
      };
    }

    log.info("BUY filled", {
      orderId: resp.orderID,
      latencyMs,
      status: resp.status,
    });

    return {
      success: true,
      orderId: resp.orderID,
      size: amount,
      latencyMs,
    };
  } catch (err) {
    // --- fallback: limit order at best ask -----------------------
    log.warn("Market order threw — falling back to limit order at best ask");
    return executeLimitBuy(client, config, tokenId, amount, t0);
  }
}

/**
 * Limit-order fallback: fetch the orderbook, price at the best ask,
 * and post as GTC.
 */
async function executeLimitBuy(
  client: PolymarketClient,
  config: Config,
  tokenId: string,
  usdcAmount: number,
  t0: number,
): Promise<TradeResult> {
  try {
    const book = await client.clob.getOrderBook(tokenId);

    if (!book.asks || book.asks.length === 0) {
      return fail("No asks available in orderbook", t0);
    }

    const bestAsk = parseFloat(book.asks[0].price);
    log.info(`Best ask: ${bestAsk}`);

    if (bestAsk > config.maxPrice) {
      return fail(
        `Best ask ${bestAsk} exceeds max price ${config.maxPrice}`,
        t0,
      );
    }

    const numContracts = Math.floor(usdcAmount / bestAsk);
    if (numContracts <= 0) {
      return fail(
        `Buy amount ${usdcAmount} USDC too small for price ${bestAsk}`,
        t0,
      );
    }

    const resp = await client.clob.createAndPostOrder(
      {
        tokenID: tokenId,
        price: bestAsk,
        side: Side.BUY,
        size: numContracts,
      },
      undefined,
      OrderType.GTC,
    );

    const latencyMs = Date.now() - t0;

    if (!resp.success) {
      return {
        success: false,
        orderId: resp.orderID,
        error: resp.errorMsg || "Limit order rejected",
        latencyMs,
      };
    }

    log.info("BUY (limit fallback) filled", {
      orderId: resp.orderID,
      price: bestAsk,
      contracts: numContracts,
      latencyMs,
    });

    return {
      success: true,
      orderId: resp.orderID,
      price: bestAsk,
      size: numContracts,
      latencyMs,
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), t0);
  }
}

// ============================================================
// Sell  (manual — user-triggered)
// ============================================================

/**
 * Execute a manual sell.
 *
 * If `price` is omitted the bot sells at the current best bid.
 * `size` = number of contracts to sell.
 */
export async function executeSell(
  client: PolymarketClient,
  config: Config,
  tokenId: string,
  size: number,
  price?: number,
): Promise<TradeResult> {
  const t0 = Date.now();

  try {
    log.info(
      `SELL token=${tokenId}  contracts=${size}  limit=${price ?? "market"}`,
    );

    // If no explicit price, resolve from orderbook
    let sellPrice = price;
    if (sellPrice === undefined) {
      const book = await client.clob.getOrderBook(tokenId);
      if (!book.bids || book.bids.length === 0) {
        return fail("No bids available in orderbook", t0);
      }
      sellPrice = parseFloat(book.bids[0].price);
      log.info(`Best bid: ${sellPrice}`);
    }

    const resp = await client.clob.createAndPostOrder(
      {
        tokenID: tokenId,
        price: sellPrice,
        side: Side.SELL,
        size,
      },
      undefined,
      OrderType.GTC,
    );

    const latencyMs = Date.now() - t0;

    if (!resp.success) {
      return {
        success: false,
        orderId: resp.orderID,
        error: resp.errorMsg || "Sell order rejected",
        latencyMs,
      };
    }

    log.info("SELL order posted", {
      orderId: resp.orderID,
      price: sellPrice,
      contracts: size,
      latencyMs,
    });

    return {
      success: true,
      orderId: resp.orderID,
      price: sellPrice,
      size,
      latencyMs,
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), t0);
  }
}

// ============================================================
// Helpers
// ============================================================

function fail(error: string, t0: number): TradeResult {
  log.error(error);
  return { success: false, error, latencyMs: Date.now() - t0 };
}
