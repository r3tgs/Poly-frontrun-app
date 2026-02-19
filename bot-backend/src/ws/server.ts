import * as http from "http";
import { randomUUID } from "crypto";
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
// Per-client state
// ============================================================

interface ClientInfo {
  id: string;
  type: "phone" | "dashboard" | "unknown";
  connectedAt: number;
  activeMarket: MarketConfig | null;
  label?: string;
}

/** Minimal interface so ws/server.ts doesn't hard-depend on the kalshi module. */
interface TickerSubscriber {
  subscribe(tickers: string[]): void;
}

/** Send a clients_update message to every connected dashboard. */
function broadcastClientsUpdate(clients: Map<WebSocket, ClientInfo>): void {
  const phones = [...clients.values()].filter((c) => c.type === "phone");
  const msg: BotMessage = {
    type: "clients_update",
    data: phones.map((c) => ({
      id: c.id,
      connectedAt: c.connectedAt,
      activeMarket: c.activeMarket,
      label: c.label,
    })),
  };
  const payload = JSON.stringify(msg);
  for (const [ws, info] of clients) {
    if (info.type === "dashboard" && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// ============================================================
// Public API
// ============================================================

export function startWebSocketServer(
  config: Config,
  client: any,
  walletAddress: string,
  trading: TradingBackend,
  pnl: PnLTracker,
  priceCache?: TickerSubscriber,
): WebSocketServer {
  // Per-connection state map
  const clients = new Map<WebSocket, ClientInfo>();

  // HTTP server: health check, market search, and WebSocket host.
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

    // Active market — returns first phone's market (legacy compat)
    if (req.method === "GET" && req.url === "/active-market") {
      const firstPhone = [...clients.values()].find((c) => c.type === "phone");
      res.writeHead(200, { "Content-Type": "application/json", ...CORS });
      res.end(JSON.stringify(firstPhone?.activeMarket ?? null));
      return;
    }

    // Market search — proxies Kalshi public events API (avoids browser CORS)
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

    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("Upgrade Required");
  });

  const wss = new WebSocketServer({ server: httpServer });
  httpServer.listen(config.wsPort, "0.0.0.0", () => {
    log.info(`Listening on ws://0.0.0.0:${config.wsPort}`);
  });

  wss.on("connection", (ws) => {
    const id = randomUUID();
    clients.set(ws, {
      id,
      type: "unknown",
      connectedAt: Date.now(),
      activeMarket: null,
    });
    log.info(`Client connected: ${id}`);

    // Immediately tell the client the current bot status.
    send(ws, {
      type: "status",
      data: {
        connected: true,
        walletAddress,
        market: null,
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
        await handleMessage(ws, wss, clients, message, config, client, walletAddress, trading, pnl, priceCache);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`Unhandled error: ${msg}`);
        send(ws, {
          type: "error",
          data: { message: msg, timestamp: Date.now() },
        });
      }
    });

    ws.on("close", () => {
      const info = clients.get(ws);
      clients.delete(ws);
      log.info(`Client disconnected: ${info?.id}`);
      // Notify dashboards whenever a phone drops
      if (info?.type === "phone") {
        broadcastClientsUpdate(clients);
      }
    });

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
  clients: Map<WebSocket, ClientInfo>,
  message: AppMessage,
  config: Config,
  client: any,
  walletAddress: string,
  trading: TradingBackend,
  pnl: PnLTracker,
  priceCache?: TickerSubscriber,
): Promise<void> {
  const senderInfo = clients.get(ws);

  switch (message.type) {
    // ----------------------------------------------------------
    // Register — identify this connection as phone or dashboard
    // ----------------------------------------------------------
    case "register": {
      if (senderInfo) {
        senderInfo.type = message.data.clientType;
        if (message.data.label) senderInfo.label = message.data.label;
      }
      log.info(`Client registered as ${message.data.clientType}: ${senderInfo?.id}`);
      // Send this dashboard the current phone list immediately
      if (message.data.clientType === "dashboard") {
        const phones = [...clients.values()].filter((c) => c.type === "phone");
        send(ws, {
          type: "clients_update",
          data: phones.map((c) => ({
            id: c.id,
            connectedAt: c.connectedAt,
            activeMarket: c.activeMarket,
            label: c.label,
          })),
        });
      }
      // Tell all dashboards the updated roster
      broadcastClientsUpdate(clients);
      return;
    }

    // ----------------------------------------------------------
    // Configure Market for a specific phone (dashboard → bot → phone)
    // ----------------------------------------------------------
    case "configure_client_market": {
      const { clientId, market } = message.data;
      for (const [targetWs, targetInfo] of clients) {
        if (targetInfo.id === clientId) {
          targetInfo.activeMarket = market;
          if (priceCache && (market.homeKalshiTicker || market.awayKalshiTicker)) {
            const tickers = [market.homeKalshiTicker, market.awayKalshiTicker].filter(Boolean) as string[];
            priceCache.subscribe(tickers);
            log.info(`Price cache subscribing to: ${tickers.join(", ")}`);
          }
          send(targetWs, { type: "market_configured", data: market });
          log.info(`Market configured for client ${clientId}: ${JSON.stringify(market)}`);
          break;
        }
      }
      broadcastClientsUpdate(clients);
      return;
    }

    // ----------------------------------------------------------
    // Configure Market (phone self-configures on connect)
    // ----------------------------------------------------------
    case "configure_market": {
      const market = message.data;
      if (senderInfo) {
        senderInfo.activeMarket = market;
      }
      log.info("Market configured", market);
      if (priceCache && (market.homeKalshiTicker || market.awayKalshiTicker)) {
        const tickers = [market.homeKalshiTicker, market.awayKalshiTicker].filter(Boolean) as string[];
        priceCache.subscribe(tickers);
        log.info(`Price cache subscribing to: ${tickers.join(", ")}`);
      }
      send(ws, { type: "market_configured", data: market });
      if (senderInfo?.type === "phone") {
        broadcastClientsUpdate(clients);
      }
      return;
    }

    // ----------------------------------------------------------
    // Buy Signal  (the core frontrun action)
    // ----------------------------------------------------------
    case "signal": {
      const activeMarket = senderInfo?.activeMarket ?? null;
      if (!activeMarket) {
        send(ws, {
          type: "error",
          data: {
            message: "No market configured. Send configure_market first.",
            timestamp: Date.now(),
          },
        });
        return;
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
      return;
    }

    // ----------------------------------------------------------
    // Manual Sell
    // ----------------------------------------------------------
    case "sell": {
      const activeMarket = senderInfo?.activeMarket ?? null;
      if (!activeMarket) {
        send(ws, {
          type: "error",
          data: {
            message: "No market configured. Send configure_market first.",
            timestamp: Date.now(),
          },
        });
        return;
      }

      const { team, price } = message.data;
      let sellSize = message.data.size;
      const tokenId = getTradeId(activeMarket, team);

      // size=0 means "sell all" — use PnL position if known
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
      return;
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
      return;
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
          market: senderInfo?.activeMarket ?? null,
          testMode: config.testMode,
          timestamp: Date.now(),
        },
      });
      return;
    }

    default:
      send(ws, {
        type: "error",
        data: {
          message: `Unknown message type: ${(message as { type: string }).type}`,
          timestamp: Date.now(),
        },
      });
      return;
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
 * Returns the platform-specific trading identifier for a team.
 *
 * For Kalshi: "<ticker>::YES" or "<ticker>::NO"
 *   - Same ticker for both teams → binary market: home=YES, away=NO
 *   - Different tickers → each team buys YES on their own ticker
 * For Polymarket US: "<slug>::LONG" or "<slug>::SHORT"
 * For Polymarket CLOB: raw token ID
 */
function getTradeId(market: MarketConfig, team: "home" | "away"): string {
  // Kalshi: ticker-based
  if (market.homeKalshiTicker || market.awayKalshiTicker) {
    const ticker = (team === "home" ? market.homeKalshiTicker : market.awayKalshiTicker) ?? "";
    const sameTicker = market.homeKalshiTicker === market.awayKalshiTicker;
    const side = (team === "away" && sameTicker) ? "NO" : "YES";
    return `${ticker}::${side}`;
  }
  // Polymarket US: slug-based
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
