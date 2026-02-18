import { Config } from "../config";
import { createLogger } from "../logger";
import { TradeResult } from "../polymarket/trading";

const log = createLogger("SimTrading");

// ============================================================
// Simulated market state
// ============================================================

/** Simulated price per token. Starts at a reasonable pre-event level. */
const simPrices = new Map<string, number>();

function getSimPrice(tokenId: string): number {
  if (!simPrices.has(tokenId)) {
    // Random initial price between 0.35 and 0.65
    simPrices.set(tokenId, 0.35 + Math.random() * 0.3);
  }
  return simPrices.get(tokenId)!;
}

/** After a buy, simulate the price drifting up (score event → odds correct). */
function applyBuyDrift(tokenId: string): void {
  const current = getSimPrice(tokenId);
  // Price jumps 5–15 cents to simulate odds correcting after a score
  const drift = 0.05 + Math.random() * 0.10;
  simPrices.set(tokenId, Math.min(current + drift, 0.99));
}

let orderCounter = 0;
function nextOrderId(): string {
  orderCounter++;
  return `SIM-${Date.now()}-${orderCounter}`;
}

/** Simulated network + matching latency (80–250 ms). */
function simulatedLatency(): number {
  return 80 + Math.floor(Math.random() * 170);
}

// ============================================================
// Simulated Buy
// ============================================================

export async function executeBuy(
  _client: null,
  config: Config,
  tokenId: string,
  usdcAmount?: number,
): Promise<TradeResult> {
  const t0 = Date.now();
  const amount = usdcAmount ?? config.defaultBuySize;

  // Simulate network delay
  const delay = simulatedLatency();
  await sleep(delay);

  const price = getSimPrice(tokenId);

  const contracts = Math.floor(amount / price);
  if (contracts <= 0) {
    return {
      success: false,
      error: `Buy amount ${amount} USDC too small for simulated price ${price.toFixed(4)}`,
      latencyMs: Date.now() - t0,
    };
  }

  const orderId = nextOrderId();

  log.info(
    `[SIM] BUY FILLED  orderId=${orderId}  ` +
      `${contracts} contracts @ ${price.toFixed(4)}  ` +
      `cost=$${(contracts * price).toFixed(2)}  ` +
      `latency=${Date.now() - t0}ms`,
  );

  // Simulate odds correcting after the score event
  applyBuyDrift(tokenId);

  return {
    success: true,
    orderId,
    price,
    size: contracts,
    latencyMs: Date.now() - t0,
  };
}

// ============================================================
// Simulated Sell
// ============================================================

export async function executeSell(
  _client: null,
  config: Config,
  tokenId: string,
  size: number,
  price?: number,
): Promise<TradeResult> {
  const t0 = Date.now();

  const delay = simulatedLatency();
  await sleep(delay);

  // Use provided price or the current sim price (which drifted up after buy)
  const sellPrice = price ?? getSimPrice(tokenId);
  const orderId = nextOrderId();

  log.info(
    `[SIM] SELL FILLED  orderId=${orderId}  ` +
      `${size} contracts @ ${sellPrice.toFixed(4)}  ` +
      `revenue=$${(size * sellPrice).toFixed(2)}  ` +
      `latency=${Date.now() - t0}ms`,
  );

  return {
    success: true,
    orderId,
    price: sellPrice,
    size,
    latencyMs: Date.now() - t0,
  };
}

// ============================================================
// Helpers
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
