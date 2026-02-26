import WebSocket from "ws";
import * as crypto from "crypto";
import { createLogger } from "../logger";
import { KalshiTradeEntry } from "../types";

const log = createLogger("KalshiTrades");

const WS_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2";
const WS_PATH = "/trade-api/ws/v2";
const RECONNECT_MS = 2_000;
/** How long to keep fill records and recent trade entries for late-fill matching. */
const OWN_TRADE_TTL_MS = 60_000;

type TradeListener = (entry: KalshiTradeEntry) => void;

/**
 * Subscribes to Kalshi's public `trade` channel for live market fills
 * and to the private `fill` channel to identify own trades.
 *
 * When a trade event arrives whose trade_id matches a fill event we
 * received on the private channel, `isOwn` is set to true so the
 * dashboard can highlight it.
 */
export class TradeStream {
  private ws: WebSocket | null = null;
  private subscribedTickers: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private cmdId = 1;
  private stopped = false;
  private listeners = new Set<TradeListener>();

  // trade_id → { timestamp, action } from the private fill channel.
  private ownTradeIds = new Map<string, { ts: number; action: "buy" | "sell"; side: "yes" | "no" }>();

  // Buffer of recently dispatched trade entries — used for late-fill re-emission.
  // When a fill event arrives after the matching trade event was already dispatched
  // (the common case on Kalshi), we re-emit the entry with isOwn=true.
  private recentTrades = new Map<string, KalshiTradeEntry>();

  constructor(
    private readonly apiKey: string,
    private readonly privateKeyPem: string,
  ) {}

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  /** Subscribe to the trade channel for these market tickers. */
  subscribe(tickers: string[]): void {
    const newTickers = tickers.filter((t) => !this.subscribedTickers.includes(t));
    if (newTickers.length === 0) return;
    this.subscribedTickers.push(...newTickers);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendTradeSubscribe(newTickers);
    } else {
      this.connect();
    }
  }

  /** Register a listener for incoming trade events. Returns an unsubscribe fn. */
  addListener(fn: TradeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.terminate();
  }

  // ----------------------------------------------------------------
  // WebSocket management
  // ----------------------------------------------------------------

  private connect(): void {
    if (this.stopped) return;
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
    }

    log.info("Connecting to Kalshi trade feed…");
    this.ws = new WebSocket(WS_URL, { headers: this.authHeaders() });

    this.ws.on("open", () => {
      log.info("Kalshi trade feed connected");
      // Subscribe to own-fill channel first (account-wide, no tickers needed).
      this.sendFillSubscribe();
      // Subscribe to public trade channel for known tickers.
      if (this.subscribedTickers.length > 0) {
        this.sendTradeSubscribe(this.subscribedTickers);
      }
    });

    this.ws.on("message", (raw: Buffer) => {
      try {
        this.handleMessage(JSON.parse(raw.toString()));
      } catch {
        /* ignore malformed frames */
      }
    });

    this.ws.on("close", () => {
      if (!this.stopped) {
        log.warn(`Kalshi trade feed closed — reconnecting in ${RECONNECT_MS}ms`);
        this.scheduleReconnect();
      }
    });

    this.ws.on("error", (err: Error) => {
      log.error(`Kalshi trade feed error: ${err.message}`);
    });
  }

  private sendTradeSubscribe(tickers: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        id: this.cmdId++,
        cmd: "subscribe",
        params: { channels: ["trade"], market_tickers: tickers },
      }),
    );
    log.info(`Trade feed subscribed: ${tickers.join(", ")}`);
  }

  private sendFillSubscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // The fill channel is account-wide and does not require market_tickers.
    this.ws.send(
      JSON.stringify({
        id: this.cmdId++,
        cmd: "subscribe",
        params: { channels: ["fill"] },
      }),
    );
    log.info("Subscribed to fill channel (own trades)");
  }

  // ----------------------------------------------------------------
  // Message handling
  // ----------------------------------------------------------------

  private handleMessage(msg: any): void {
    // Private fill — record the trade_id so we can mark it as own.
    if (msg.type === "fill" && msg.msg) {
      const { trade_id, action, side } = msg.msg;
      if (trade_id) {
        const act: "buy" | "sell" = action === "sell" ? "sell" : "buy";
        const ownSide: "yes" | "no" = side === "no" ? "no" : "yes";
        this.ownTradeIds.set(trade_id, { ts: Date.now(), action: act, side: ownSide });
        this.cleanupOwnTradeIds();
        log.info(`Own fill: trade_id=${trade_id} action=${act} side=${ownSide}`);

        // If the matching trade event already arrived (race: trade before fill),
        // re-emit it now with isOwn=true so the dashboard gets corrected.
        const existing = this.recentTrades.get(trade_id);
        if (existing && !existing.isOwn) {
          const updated: KalshiTradeEntry = { ...existing, isOwn: true, action: act, ownSide };
          this.recentTrades.set(trade_id, updated);
          log.info(`Late-fill re-emit: trade_id=${trade_id} — updating dashboard to isOwn=true`);
          this.listeners.forEach((fn) => fn(updated));
        }
      }
      return;
    }

    // Public trade — broadcast to listeners.
    if (msg.type === "trade" && msg.msg) {
      const { market_ticker, trade_id, count, yes_price, taker_side, created_time } = msg.msg;
      if (!market_ticker || !trade_id) return;

      const timestamp = created_time
        ? new Date(created_time).getTime()
        : Date.now();

      const ownInfo = this.ownTradeIds.get(trade_id);
      const side: "yes" | "no" = taker_side === "no" ? "no" : "yes";

      const entry: KalshiTradeEntry = {
        tradeId: trade_id,
        ticker: market_ticker,
        count: Number(count ?? 0),
        yesPrice: Number(yes_price ?? 0),
        takerSide: side,
        timestamp,
        isOwn: !!ownInfo,
        action: ownInfo?.action,
        ownSide: ownInfo?.side,
      };

      // Buffer this entry so a late fill can re-emit it with isOwn=true.
      this.recentTrades.set(trade_id, entry);
      this.cleanupRecentTrades();

      this.listeners.forEach((fn) => fn(entry));
    }
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private cleanupOwnTradeIds(): void {
    const cutoff = Date.now() - OWN_TRADE_TTL_MS;
    for (const [id, { ts }] of this.ownTradeIds) {
      if (ts < cutoff) this.ownTradeIds.delete(id);
    }
  }

  private cleanupRecentTrades(): void {
    const cutoff = Date.now() - OWN_TRADE_TTL_MS;
    for (const [id, entry] of this.recentTrades) {
      if (entry.timestamp < cutoff) this.recentTrades.delete(id);
    }
  }

  /** RSA-PSS signing — identical to PriceCache auth. */
  private signPss(text: string): string {
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(text);
    sign.end();
    return sign
      .sign({
        key: this.privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      })
      .toString("base64");
  }

  private authHeaders(): Record<string, string> {
    const ts = Date.now().toString();
    return {
      "KALSHI-ACCESS-KEY": this.apiKey,
      "KALSHI-ACCESS-SIGNATURE": this.signPss(ts + "GET" + WS_PATH),
      "KALSHI-ACCESS-TIMESTAMP": ts,
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_MS);
  }
}
