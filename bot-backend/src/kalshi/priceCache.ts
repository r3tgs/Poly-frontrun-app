import WebSocket from "ws";
import * as crypto from "crypto";
import { createLogger } from "../logger";

const log = createLogger("KalshiWS");

const WS_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2";
const WS_PATH = "/trade-api/ws/v2";
const STALE_MS = 10_000; // treat cached price as stale after 10s without update
const RECONNECT_MS = 2_000;

interface TickerData {
  yes_ask: number; // cents
  yes_bid: number; // cents
  updatedAt: number;
}

/**
 * Maintains a live price cache by subscribing to Kalshi's WebSocket
 * `ticker` channel.  Each market tick delivers `yes_ask` and `yes_bid`
 * so that buy/sell orders can be placed immediately without an extra
 * REST round-trip to fetch the orderbook.
 *
 * Derived prices:
 *   no_ask = 100 - yes_bid   (cheapest way to buy NO)
 *   no_bid = 100 - yes_ask   (best price to sell NO)
 */
export class PriceCache {
  private readonly cache = new Map<string, TickerData>();
  private ws: WebSocket | null = null;
  private subscribedTickers: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private cmdId = 1;
  private stopped = false;

  constructor(
    private readonly apiKey: string,
    private readonly privateKeyPem: string, // must be PKCS#8
  ) {}

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  /** Subscribe to live ticker updates for additional market tickers. */
  subscribe(tickers: string[]): void {
    const newTickers = tickers.filter((t) => !this.subscribedTickers.includes(t));
    if (newTickers.length === 0) return;
    this.subscribedTickers.push(...newTickers);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(newTickers);
    } else {
      this.connect();
    }
  }

  /**
   * Best ask price in cents for buying the given side.
   * Returns null if no fresh price is cached (caller should fall back to REST).
   */
  getBestAskCents(ticker: string, side: "yes" | "no"): number | null {
    const data = this.cache.get(ticker);
    if (!data || Date.now() - data.updatedAt > STALE_MS) return null;
    if (side === "yes") {
      return data.yes_ask > 0 ? data.yes_ask : null;
    }
    // no_ask = 100 - yes_bid
    const cents = 100 - data.yes_bid;
    return cents > 0 && cents < 100 ? cents : null;
  }

  /**
   * Best bid price in cents for selling the given side.
   * Returns null if no fresh price is cached.
   */
  getBestBidCents(ticker: string, side: "yes" | "no"): number | null {
    const data = this.cache.get(ticker);
    if (!data || Date.now() - data.updatedAt > STALE_MS) return null;
    if (side === "yes") {
      return data.yes_bid > 0 ? data.yes_bid : null;
    }
    // no_bid = 100 - yes_ask
    const cents = 100 - data.yes_ask;
    return cents > 0 && cents < 100 ? cents : null;
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

    log.info("Connecting to Kalshi ticker feed…");
    this.ws = new WebSocket(WS_URL, { headers: this.authHeaders() });

    this.ws.on("open", () => {
      log.info("Kalshi WS connected — subscribing to tickers");
      if (this.subscribedTickers.length > 0) {
        this.sendSubscribe(this.subscribedTickers);
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
        log.warn(`Kalshi WS closed — reconnecting in ${RECONNECT_MS}ms`);
        this.scheduleReconnect();
      }
    });

    this.ws.on("error", (err: Error) => {
      log.error(`Kalshi WS error: ${err.message}`);
    });
  }

  private sendSubscribe(tickers: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        id: this.cmdId++,
        cmd: "subscribe",
        params: { channels: ["ticker"], market_tickers: tickers },
      }),
    );
    log.info(`Subscribed to ticker feed: ${tickers.join(", ")}`);
  }

  private handleMessage(msg: any): void {
    if (msg.type === "ticker" && msg.msg) {
      const { market_ticker, yes_ask, yes_bid } = msg.msg;
      if (market_ticker !== undefined && yes_ask !== undefined && yes_bid !== undefined) {
        const prev = this.cache.get(market_ticker);
        this.cache.set(market_ticker, {
          yes_ask: Number(yes_ask),
          yes_bid: Number(yes_bid),
          updatedAt: Date.now(),
        });
        if (!prev) {
          log.info(`[ticker] ${market_ticker}  yes_ask=${yes_ask}¢  yes_bid=${yes_bid}¢  (first update)`);
        } else {
          log.debug(`[ticker] ${market_ticker}  yes_ask=${yes_ask}¢  yes_bid=${yes_bid}¢`);
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // Auth helpers (same signing as REST — timestamp + "GET" + path)
  // ----------------------------------------------------------------

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
