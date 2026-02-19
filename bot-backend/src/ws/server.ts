import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Config } from "../config";
import { TradeResult } from "../polymarket/trading";
import { PnLTracker } from "../pnl";
import {
  AppMessage,
  BotMessage,
  MarketConfig,
  TradeUpdateMessage,
} from "../types";
import { createLogger } from "../logger";

const log = createLogger("WS");

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface MarketSearchResult {
  eventTitle: string;
  eventTicker: string;
  homeKalshiTicker: string;
  homeTitle: string;
  awayKalshiTicker: string;
  awayTitle: string;
}

async function searchKalshiMarkets(q: string): Promise<MarketSearchResult[]> {
  const params = new URLSearchParams({ status: "open", limit: "200", with_nested_markets: "true" });
  const resp = await fetch(`${KALSHI_BASE}/events?${params}`);
  if (!resp.ok) throw new Error(`Kalshi API ${resp.status}`);
  const data = await resp.json() as { events: any[] };

  const ql = q.toLowerCase().trim();
  if (!ql) return [];

  const matches = data.events.filter((e: any) => {
    const hay = `${e.event_ticker ?? ""} ${e.title ?? ""}`.toLowerCase();
    return hay.includes(ql) ||
      e.markets?.some((m: any) =>
        `${m.ticker ?? ""} ${m.subtitle ?? ""} ${m.title ?? ""}`.toLowerCase().includes(ql),
      );
  });

  return matches.slice(0, 15).map((e: any) => {
    const markets: any[] = e.markets ?? [];
    const home = markets[0];
    const away = markets[1];
    return {
      eventTitle: e.title ?? e.event_ticker,
      eventTicker: e.event_ticker,
      homeKalshiTicker: home?.ticker ?? "",
      homeTitle: home?.subtitle ?? home?.title ?? "",
      awayKalshiTicker: away?.ticker ?? home?.ticker ?? "",
      awayTitle: away?.subtitle ?? away?.title ?? "",
    };
  });
}

// ============================================================
// Trading backend interface (real or simulated)
// ============================================================

export interface TradingBackend {
  executeBuy(
    client: any,
    config: Config,
    tokenId: string,
    usdcAmount?: number,
  ): Promise<TradeResult>;
  executeSell(
    client: any,
    config: Config,
    tokenId: string,
    size: number,
    price?: number,
  ): Promise<TradeResult>;
}

// ============================================================
// Public API
// ============================================================

/** Minimal interface so ws/server.ts doesn't hard-depend on the kalshi module. */
interface TickerSubscriber {
  subscribe(tickers: string[]): void;
}

export function startWebSocketServer(
  config: Config,
  client: any,
  walletAddress: string,
  trading: TradingBackend,
  pnl: PnLTracker,
  priceCache?: TickerSubscriber,
): WebSocketServer {
  // HTTP server: health check, market search/configure APIs, and WebSocket host.
  const httpServer = http.createServer((req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain", ...CORS });
      res.end("ok");
      return;
    }

    // Active market (used by dashboard to show currently configured market)
    if (req.method === "GET" && req.url === "/active-market") {
      res.writeHead(200, { "Content-Type": "application/json", ...CORS });
      res.end(JSON.stringify(activeMarket));
      return;
    }

    // Market search — proxies Kalshi public events API (avoids browser CORS issues)
    if (req.method === "GET" && req.url?.startsWith("/search-markets")) {
      const urlObj = new URL(req.url, "http://localhost");
      const q = urlObj.searchParams.get("q") ?? "";
      searchKalshiMarkets(q)
        .then((results) => {
          res.writeHead(200, { "Content-Type": "application/json", ...CORS });
          res.end(JSON.stringify(results));
        })
        .catch((err) => {
          res.writeHead(500, { "Content-Type": "application/json", ...CORS });
          res.end(JSON.stringify({ error: String(err) }));
        });
      return;
    }

    // Configure market — dashboard POSTs here to set the active market
    if (req.method === "POST" && req.url === "/configure-market") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const market = JSON.parse(body) as MarketConfig;
          activeMarket = market;
          if (priceCache && (market.homeKalshiTicker || market.awayKalshiTicker)) {
            const tickers = [market.homeKalshiTicker, market.awayKalshiTicker].filter(Boolean) as string[];
            priceCache.subscribe(tickers);
            log.info(`Price cache subscribing to: ${tickers.join(", ")}`);
          }
          broadcast(wss, { type: "market_configured", data: market });
          log.info(`Market configured via HTTP: ${JSON.stringify(market)}`);
          res.writeHead(200, { "Content-Type": "application/json", ...CORS });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json", ...CORS });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("Upgrade Required");
  });

  const wss = new WebSocketServer({ server: httpServer });
  httpServer.listen(config.wsPort, "0.0.0.0", () => {
    log.info(`Listening on ws://0.0.0.0:${config.wsPort}`);
  });

  // Shared mutable state — the currently active market.
  let activeMarket: MarketConfig | null = null;

  wss.on("connection", (ws) => {
    log.info("Client connected");

    // Immediately tell the client the current bot status.
    send(ws, {
      type: "status",
      data: {
        connected: true,
        walletAddress,
        market: activeMarket,
        testMode: config.testMode,
        timestamp: Date.now(),
      },
    });

    ws.on("message", async (raw) => {
      let message: AppMessage;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        send(ws, {
          type: "error",
          data: { message: "Invalid JSON", timestamp: Date.now() },
        });
        return;
      }

      try {
        activeMarket = await handleMessage(
          ws,
          wss,
          message,
          config,
          client,
          walletAddress,
          activeMarket,
          trading,
          pnl,
          priceCache,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`Unhandled error: ${msg}`);
        send(ws, {
          type: "error",
          data: { message: msg, timestamp: Date.now() },
        });
      }
    });

    ws.on("close", () => log.info("Client disconnected"));
    ws.on("error", (err) => log.error("Socket error", err));
  });

  return wss;
}

// ============================================================
// Message Router
// ============================================================

async function handleMessage(
  ws: WebSocket,
  wss: WebSocketServer,
  message: AppMessage,
  config: Config,
  client: any,
  walletAddress: string,
  activeMarket: MarketConfig | null,
  trading: TradingBackend,
  pnl: PnLTracker,
  priceCache?: TickerSubscriber,
): Promise<MarketConfig | null> {
  switch (message.type) {
    // ----------------------------------------------------------
    // Configure Market
    // ----------------------------------------------------------
    case "configure_market": {
      const market = message.data;
      log.info("Market configured", market);
      if (priceCache && (market.homeKalshiTicker || market.awayKalshiTicker)) {
        const tickers = [market.homeKalshiTicker, market.awayKalshiTicker].filter(Boolean) as string[];
        priceCache.subscribe(tickers);
        log.info(`Price cache subscribing to: ${tickers.join(", ")}`);
      }
      broadcast(wss, { type: "market_configured", data: market });
      return market;
    }

    // ----------------------------------------------------------
    // Buy Signal  (the core frontrun action)
    // ----------------------------------------------------------
    case "signal": {
      if (!activeMarket) {
        send(ws, {
          type: "error",
          data: {
            message: "No market configured. Send configure_market first.",
            timestamp: Date.now(),
          },
        });
        return activeMarket;
      }

      const { team, size } = message.data;
      const tokenId = getTradeId(activeMarket, team);

      log.info(`BUY signal — team=${team}  token=${tokenId}`);

      // Notify all clients the order is in-flight.
      broadcast(wss, pendingUpdate("buy", team));

      const result = await trading.executeBuy(client, config, tokenId, size);

      if (result.success && result.size) {
        pnl.recordBuy(tokenId, team, result.size, result.price ?? 0);
      }

      const update: TradeUpdateMessage = {
        type: "trade_update",
        data: {
          action: "buy",
          team,
          orderId: result.orderId,
          status: result.success ? "filled" : "failed",
          price: result.price,
          size: result.size,
          timestamp: Date.now(),
          latencyMs: result.latencyMs,
          error: result.error,
        },
      };
      broadcast(wss, update);
      return activeMarket;
    }

    // ----------------------------------------------------------
    // Manual Sell
    // ----------------------------------------------------------
    case "sell": {
      if (!activeMarket) {
        send(ws, {
          type: "error",
          data: {
            message: "No market configured. Send configure_market first.",
            timestamp: Date.now(),
          },
        });
        return activeMarket;
      }

      const { team, price } = message.data;
      let sellSize = message.data.size;
      const tokenId = getTradeId(activeMarket, team);

      // size=0 means "sell all" — use PnL position if known, otherwise let
      // the trading backend close via API (handles bot-restart case)
      if (!sellSize || sellSize <= 0) {
        const snap = pnl.getSnapshot();
        const pos = snap.positions.find((p) => p.tokenId === tokenId);
        sellSize = pos ? pos.contracts : 0;
        log.info(`SELL ALL — team=${team}  contracts=${sellSize || "unknown (closing via API)"}  token=${tokenId}`);
      } else {
        log.info(`SELL signal — team=${team}  size=${sellSize}  token=${tokenId}`);
      }

      broadcast(wss, pendingUpdate("sell", team));

      const result = await trading.executeSell(client, config, tokenId, sellSize, price);

      if (result.success && result.price && result.size) {
        pnl.recordSell(tokenId, result.size, result.price);
      }

      const sellUpdate: TradeUpdateMessage = {
        type: "trade_update",
        data: {
          action: "sell",
          team,
          orderId: result.orderId,
          status: result.success ? "filled" : "failed",
          price: result.price,
          size: result.size,
          timestamp: Date.now(),
          latencyMs: result.latencyMs,
          error: result.error,
        },
      };
      broadcast(wss, sellUpdate);
      return activeMarket;
    }

    // ----------------------------------------------------------
    // P&L Summary
    // ----------------------------------------------------------
    case "pnl": {
      const snap = pnl.getSnapshot();
      pnl.printSummary();
      send(ws, {
        type: "pnl",
        data: {
          totalSpent: snap.totalSpent,
          totalReceived: snap.totalReceived,
          realizedPnl: snap.realizedPnl,
          unrealizedPnl: snap.unrealizedPnl,
          openPositions: snap.positions.length,
          tradeCount: snap.tradeCount,
          timestamp: Date.now(),
        },
      });
      return activeMarket;
    }

    // ----------------------------------------------------------
    // Status
    // ----------------------------------------------------------
    case "status": {
      send(ws, {
        type: "status",
        data: {
          connected: true,
          walletAddress,
          market: activeMarket,
          testMode: config.testMode,
          timestamp: Date.now(),
        },
      });
      return activeMarket;
    }

    default:
      send(ws, {
        type: "error",
        data: {
          message: `Unknown message type: ${(message as { type: string }).type}`,
          timestamp: Date.now(),
        },
      });
      return activeMarket;
  }
}

// ============================================================
// Helpers
// ============================================================

function send(ws: WebSocket, msg: BotMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(wss: WebSocketServer, msg: BotMessage): void {
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

/**
 * Resolve the platform-specific trading identifier for a team.
 *
 * - Polymarket US:   returns the market slug for that outcome
 * - Polymarket CLOB: returns the token ID for that outcome
 */
/**
 * Returns the platform-specific trading identifier for a team.
 *
 * For Polymarket US the format is: "<marketSlug>::<LONG|SHORT>"
 *   - Binary Yes/No markets: separate slugs, both sides use LONG
 *   - Sports moneyline markets: same slug, home=LONG, away=SHORT (awayIsShort=true)
 * For Polymarket CLOB: returns the raw token ID.
 */
function getTradeId(market: MarketConfig, team: "home" | "away"): string {
  // Kalshi: ticker-based, sides are YES/NO
  if (market.homeKalshiTicker || market.awayKalshiTicker) {
    const ticker = (team === "home" ? market.homeKalshiTicker : market.awayKalshiTicker) ?? "";
    // Same ticker for both teams = binary market: home=YES, away=NO
    const sameTicker = market.homeKalshiTicker === market.awayKalshiTicker;
    const side = (team === "away" && sameTicker) ? "NO" : "YES";
    return `${ticker}::${side}`;
  }
  // Polymarket US: slug-based, sides are LONG/SHORT
  if (market.homeMarketSlug || market.awayMarketSlug) {
    const slug = (team === "home" ? market.homeMarketSlug : market.awayMarketSlug) ?? "";
    const intent = (team === "away" && market.awayIsShort) ? "SHORT" : "LONG";
    return `${slug}::${intent}`;
  }
  // Polymarket CLOB: raw token ID
  return (team === "home" ? market.homeTokenId : market.awayTokenId) ?? "";
}

function pendingUpdate(
  action: "buy" | "sell",
  team: "home" | "away",
): TradeUpdateMessage {
  return {
    type: "trade_update",
    data: {
      action,
      team,
      status: "pending",
      timestamp: Date.now(),
    },
  };
}
