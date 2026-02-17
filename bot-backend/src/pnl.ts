import { createLogger } from "./logger";

const log = createLogger("PnL");

// ============================================================
// Types
// ============================================================

export interface Position {
  tokenId: string;
  team: "home" | "away";
  contracts: number;
  avgBuyPrice: number;
  totalCost: number;
}

export interface PnLSnapshot {
  /** Total USDC spent on buys */
  totalSpent: number;
  /** Total USDC received from sells */
  totalReceived: number;
  /** Realized P&L (sells - cost basis of sold contracts) */
  realizedPnl: number;
  /** Unrealized P&L based on simulated current prices */
  unrealizedPnl: number;
  /** Open positions */
  positions: Position[];
  /** Trade count */
  tradeCount: number;
}

// ============================================================
// Tracker
// ============================================================

export class PnLTracker {
  private positions = new Map<string, Position>();
  private totalSpent = 0;
  private totalReceived = 0;
  private realizedPnl = 0;
  private tradeCount = 0;

  recordBuy(
    tokenId: string,
    team: "home" | "away",
    contracts: number,
    price: number,
  ): void {
    const cost = contracts * price;
    this.totalSpent += cost;
    this.tradeCount++;

    const existing = this.positions.get(tokenId);
    if (existing) {
      const totalContracts = existing.contracts + contracts;
      existing.avgBuyPrice =
        (existing.totalCost + cost) / totalContracts;
      existing.contracts = totalContracts;
      existing.totalCost += cost;
    } else {
      this.positions.set(tokenId, {
        tokenId,
        team,
        contracts,
        avgBuyPrice: price,
        totalCost: cost,
      });
    }

    log.info(
      `BUY recorded: ${contracts} @ ${price.toFixed(4)} = $${cost.toFixed(2)}`,
    );
  }

  recordSell(
    tokenId: string,
    contracts: number,
    price: number,
  ): void {
    const revenue = contracts * price;
    this.totalReceived += revenue;
    this.tradeCount++;

    const pos = this.positions.get(tokenId);
    if (pos) {
      const costBasis = contracts * pos.avgBuyPrice;
      this.realizedPnl += revenue - costBasis;
      pos.contracts -= contracts;
      pos.totalCost -= costBasis;

      if (pos.contracts <= 0) {
        this.positions.delete(tokenId);
      }
    } else {
      // Selling without a tracked position — just record revenue
      this.realizedPnl += revenue;
    }

    log.info(
      `SELL recorded: ${contracts} @ ${price.toFixed(4)} = $${revenue.toFixed(2)}  ` +
        `realized P&L: $${this.realizedPnl.toFixed(2)}`,
    );
  }

  getSnapshot(currentPrices?: Map<string, number>): PnLSnapshot {
    let unrealizedPnl = 0;
    const positions: Position[] = [];

    for (const pos of this.positions.values()) {
      positions.push({ ...pos });
      if (currentPrices) {
        const currentPrice = currentPrices.get(pos.tokenId) ?? pos.avgBuyPrice;
        unrealizedPnl += pos.contracts * (currentPrice - pos.avgBuyPrice);
      }
    }

    return {
      totalSpent: this.totalSpent,
      totalReceived: this.totalReceived,
      realizedPnl: this.realizedPnl,
      unrealizedPnl,
      positions,
      tradeCount: this.tradeCount,
    };
  }

  printSummary(): void {
    const snap = this.getSnapshot();
    log.info("═══════════════ P&L Summary ═══════════════");
    log.info(`  Trades:        ${snap.tradeCount}`);
    log.info(`  Total spent:   $${snap.totalSpent.toFixed(2)}`);
    log.info(`  Total received:$${snap.totalReceived.toFixed(2)}`);
    log.info(`  Realized P&L:  $${snap.realizedPnl.toFixed(2)}`);
    log.info(
      `  Open positions: ${snap.positions.length}` +
        (snap.positions.length > 0
          ? ` (${snap.positions.map((p) => `${p.team}:${p.contracts}@${p.avgBuyPrice.toFixed(4)}`).join(", ")})`
          : ""),
    );
    log.info("═══════════════════════════════════════════");
  }
}
