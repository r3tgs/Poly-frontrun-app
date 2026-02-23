import * as fs from "fs";
import * as path from "path";
import type { KalshiTradeEntry, StoredTrade } from "./types";

// Prefer /data (fly.io persistent volume) when mounted, otherwise use cwd (dev / no-volume)
const DATA_FILE = fs.existsSync("/data")
  ? "/data/dashboard-state.json"
  : path.join(process.cwd(), "dashboard-state.json");

interface PersistedState {
  trades: StoredTrade[];
  ownFeed: KalshiTradeEntry[];
  defaultTradeSize: number;
}

const MAX_TRADES = 500;
const MAX_OWN_FEED = 200;

export class DataStore {
  private state: PersistedState;

  constructor(defaultSize: number) {
    this.state = this.load(defaultSize);
  }

  private load(defaultSize: number): PersistedState {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return {
        trades: Array.isArray(parsed.trades) ? parsed.trades : [],
        ownFeed: Array.isArray(parsed.ownFeed) ? parsed.ownFeed : [],
        defaultTradeSize:
          typeof parsed.defaultTradeSize === "number"
            ? parsed.defaultTradeSize
            : defaultSize,
      };
    } catch {
      return { trades: [], ownFeed: [], defaultTradeSize: defaultSize };
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state));
    } catch {}
  }

  addTrade(trade: StoredTrade): void {
    this.state.trades.unshift(trade);
    if (this.state.trades.length > MAX_TRADES) {
      this.state.trades.length = MAX_TRADES;
    }
    this.save();
  }

  /** Upsert an own-feed entry (same logic as the frontend orderFeed reducer). */
  upsertOwnFeedEntry(entry: KalshiTradeEntry): void {
    if (!entry.isOwn) return; // only persist own trades
    const idx = this.state.ownFeed.findIndex((t) => t.tradeId === entry.tradeId);
    if (idx !== -1) {
      this.state.ownFeed[idx] = entry;
    } else {
      this.state.ownFeed.unshift(entry);
      if (this.state.ownFeed.length > MAX_OWN_FEED) {
        this.state.ownFeed.length = MAX_OWN_FEED;
      }
    }
    this.save();
  }

  setDefaultTradeSize(size: number): void {
    this.state.defaultTradeSize = size;
    this.save();
  }

  getState(): PersistedState {
    return this.state;
  }

  getDefaultTradeSize(): number {
    return this.state.defaultTradeSize;
  }
}
