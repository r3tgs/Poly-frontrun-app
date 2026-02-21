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
  /** Total USDC spent on buys (gross + fees) */
  totalSpent: number;
  /** Total USDC received from sells (gross - fees) */
  totalReceived: number;
  /** Total exchange fees paid */
  totalFees: number;
  /** Realized P&L (net sells - cost basis including fees) */
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
  private totalFees = 0;
  private realizedPnl = 0;
  private tradeCount = 0;

  recordBuy(
    tokenId: string,
    team: "home" | "away",
    contracts: number,
    price: number,
    fee = 0,
  ): void {
    const gross = contracts * price;
    const cost = gross + fee;
    this.totalSpent += cost;
    this.totalFees += fee;
    this.tradeCount++;

    const existing = this.positions.get(tokenId);
    if (existing) {
      const totalContracts = existing.contracts + contracts;
      // avgBuyPrice tracks cost-per-contract including fees
      existing.avgBuyPrice = (existing.totalCost + cost) / totalContracts;
      existing.contracts = totalContracts;
      existing.totalCost += cost;
    } else {
      this.positions.set(tokenId, {
        tokenId,
        team,
        contracts,
        avgBuyPrice: cost / contracts,
        totalCost: cost,
      });
    }

    log.info(
      `BUY recorded: ${contracts} @ ${price.toFixed(4)} + $${fee.toFixed(2)} fee = $${cost.toFixed(2)} total`,
    );
  }

  recordSell(
    tokenId: string,
    contracts: number,
    price: number,
    fee = 0,
  ): void {
    const gross = contracts * price;
    const net = gross - fee;
    this.totalReceived += net;
    this.totalFees += fee;
    this.tradeCount++;

    const pos = this.positions.get(tokenId);
    if (pos) {
      const costBasis = contracts * pos.avgBuyPrice;
      this.realizedPnl += net - costBasis;
      pos.contracts -= contracts;
      pos.totalCost -= costBasis;

      if (pos.contracts <= 0) {
        this.positions.delete(tokenId);
      }
    } else {
      // No tracked buy — can't compute P&L without cost basis.
      // Record the trade but don't fabricate profit.
      log.warn(
        `SELL recorded with no tracked buy position for ${tokenId} — P&L not updated (unknown cost basis)`,
      );
    }

    log.info(
      `SELL recorded: ${contracts} @ ${price.toFixed(4)} - $${fee.toFixed(2)} fee = $${net.toFixed(2)} net  ` +
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
      totalFees: this.totalFees,
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
    log.info(`  Total spent:   $${snap.totalSpent.toFixed(2)} (incl. fees)`);
    log.info(`  Total received:$${snap.totalReceived.toFixed(2)} (net of fees)`);
    log.info(`  Total fees:    $${snap.totalFees.toFixed(2)}`);
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
