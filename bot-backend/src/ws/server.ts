import * as http from "http";
import { randomUUID } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { Config } from "../config";
import { TradeResult } from "../polymarket/trading";
import { PnLTracker } from "../pnl";
import { DataStore } from "../dataStore";
import {
  AppMessage,
  BotMessage,
  MarketConfig,
  TradeUpdateMessage,
  KalshiTradeEntry,
  PricePoint,
  StoredTrade,
} from "../types";
import { createLogger, addLogListener } from "../logger";

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

/** Get market open timestamp from the public Kalshi API. Falls back to 7 days ago. */
async function getMarketOpenTs(ticker: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  try {
    const resp = await fetch(`${KALSHI_BASE}/markets/${ticker}`);
    if (resp.ok) {
      const data = await resp.json() as { market: any };
      const m = data.market ?? {};
      const openStr: string | undefined = m.open_time ?? m.created_time;
      if (openStr) {
        const parsed = Math.floor(new Date(openStr).getTime() / 1000);
        if (parsed > 0 && parsed < now) return parsed;
      }
    }
  } catch { /* use fallback */ }
  return now - 7 * 24 * 3600;
}

/**
 * Fetch price history via the authenticated Kalshi SDK and broadcast to dashboards.
 *
 * Mirrors Kalshi's default LIVE view:
 *   - Always 1-minute candles (shows jagged real price movement)
 *   - Start from the later of: market open time OR 24 hours ago
 *     (caps at ~1440 points for older markets while always showing today's full session)
 *
 * Uses batchGetMarketCandlesticks to fetch both tickers in one authenticated call.
 *
 * If targetWs is set, sends only to that connection (e.g. on page refresh).
 * Otherwise broadcasts to all connected dashboards.
 */
function fetchAndBroadcastPriceHistory(
  clients: Map<WebSocket, ClientInfo>,
  market: MarketConfig,
  kalshiClient: any,
  targetWs?: WebSocket,
): void {
  const homeTicker = market.homeKalshiTicker ?? "";
  const awayTicker = market.awayKalshiTicker ?? homeTicker;
  if (!homeTicker) return;

  if (!kalshiClient?.markets?.batchGetMarketCandlesticks) {
    log.warn("No authenticated Kalshi client — skipping price history fetch");
    return;
  }

  const isBinary = homeTicker === awayTicker;

  (async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const marketOpenTs = await getMarketOpenTs(homeTicker);

      // LIVE view: 1-minute candles, starting from the later of market open or 3h ago.
      // 3h cap keeps the dataset tight (~180 pts max) and matches Kalshi's LIVE chart
      // which focuses on the current session, not the full pre-match history.
      const periodInterval = 1;
      const startTs = Math.max(marketOpenTs, now - 3 * 3600);

      // Fetch both tickers in one authenticated SDK call
      const tickerParam = isBinary ? homeTicker : `${homeTicker},${awayTicker}`;
      const resp = await kalshiClient.markets.batchGetMarketCandlesticks(
        tickerParam,
        startTs,
        now,
        periodInterval,
      );

      const marketsList: any[] = resp.data.markets ?? [];

      /**
       * Parse candlestick array into PricePoint[].
       *
       * Price priority (mirrors Kalshi's continuous chart):
       *   1. price.close  — last actual trade in this 1-min window (most accurate)
       *   2. bid/ask midpoint — always present even with no trades; keeps the line
       *      continuous during quiet periods (this is what Kalshi uses to avoid gaps)
       *   3. ask alone / bid alone — edge cases where only one side has an order
       */
      const parseCandles = (arr: any[]): PricePoint[] =>
        arr
          .map((c: any) => {
            const traded = Number(c.price?.close ?? 0);
            const bid    = Number(c.yes_bid?.close ?? 0);
            const ask    = Number(c.yes_ask?.close ?? 0);
            const mid    = bid > 0 && ask > 0 ? Math.round((bid + ask) / 2) : 0;
            const price  = traded > 0 ? traded
                         : mid    > 0 ? mid
                         : ask    > 0 ? ask
                         : bid;
            return { ts: Number(c.end_period_ts ?? 0) * 1000, price };
          })
          .filter((p: PricePoint) => p.ts > 0 && p.price > 0);

      const homeData = marketsList.find((m: any) => m.market_ticker === homeTicker);
      const awayData = isBinary ? null : marketsList.find((m: any) => m.market_ticker === awayTicker);

      const homePoints = parseCandles(homeData?.candlesticks ?? []);
      const awayPoints = isBinary ? [] : parseCandles(awayData?.candlesticks ?? []);

      if (homePoints.length === 0 && awayPoints.length === 0) {
        log.warn(`Price history: no data returned for ${tickerParam}`);
        return;
      }

      const msg: BotMessage = {
        type: "price_history",
        data: { homeTicker, awayTicker, homePoints, awayPoints },
      };
      const payload = JSON.stringify(msg);

      if (targetWs) {
        if (targetWs.readyState === WebSocket.OPEN) targetWs.send(payload);
      } else {
        for (const [ws, info] of clients) {
          if (info.type === "dashboard" && ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        }
      }

    } catch (err) {
      log.warn(`Price history fetch failed for ${homeTicker}/${awayTicker}: ${err}`);
    }
  })();
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
      homeTitle: home?.yes_sub_title || home?.subtitle || home?.title || "",
      awayKalshiTicker: away?.ticker ?? home?.ticker ?? "",
      awayTitle: away?.yes_sub_title || away?.subtitle || away?.title || "",
    };
  });
}

interface MarketLookupResult {
  homeKalshiTicker: string;
  homeTitle: string;
  awayKalshiTicker: string;
  awayTitle: string;
  description: string;
}

async function lookupKalshiMarket(ticker: string): Promise<MarketLookupResult> {
  // Helper: build result from an event with nested markets
  function resultFromEvent(event: any): MarketLookupResult | null {
    const markets: any[] = event.markets ?? [];
    const description: string = event.title ?? event.event_ticker ?? ticker;
    if (markets.length >= 2) {
      return {
        homeKalshiTicker: markets[0].ticker,
        homeTitle: markets[0].yes_sub_title || markets[0].subtitle || markets[0].title || markets[0].ticker,
        awayKalshiTicker: markets[1].ticker,
        awayTitle: markets[1].yes_sub_title || markets[1].subtitle || markets[1].title || markets[1].ticker,
        description,
      };
    }
    if (markets.length === 1) {
      const m = markets[0];
      return {
        homeKalshiTicker: m.ticker,
        homeTitle: m.yes_sub_title || m.subtitle || "Yes",
        awayKalshiTicker: m.ticker,
        awayTitle: m.no_sub_title || "No",
        description,
      };
    }
    return null;
  }

  // Strategy 1: direct market lookup → then fetch its parent event
  try {
    const mResp = await fetch(`${KALSHI_BASE}/markets/${ticker}`);
    if (mResp.ok) {
      const mData = await mResp.json() as { market: any };
      const m = mData.market;
      if (m?.status && m.status !== "open") {
        throw new Error(`Market is ${m.status} (not open for trading).`);
      }
      const eventTicker: string = m?.event_ticker ?? ticker;
      const eResp = await fetch(`${KALSHI_BASE}/events/${eventTicker}?with_nested_markets=true`);
      if (eResp.ok) {
        const eData = await eResp.json() as { event: any };
        const result = resultFromEvent(eData.event ?? {});
        if (result) return result;
      }
      // Binary fallback
      return {
        homeKalshiTicker: ticker,
        homeTitle: m.yes_sub_title || m.subtitle || "Yes",
        awayKalshiTicker: ticker,
        awayTitle: m.no_sub_title || "No",
        description: m.title || ticker,
      };
    }
  } catch (err) {
    // Only rethrow if it's a closed-market error we threw ourselves
    if (err instanceof Error && err.message.startsWith("Market is ")) throw err;
  }

  // Strategy 2: treat the ticker as an event ticker directly
  try {
    const eResp = await fetch(`${KALSHI_BASE}/events/${ticker}?with_nested_markets=true`);
    if (eResp.ok) {
      const eData = await eResp.json() as { event: any };
      const result = resultFromEvent(eData.event ?? {});
      if (result) return result;
    }
  } catch {}

  // Strategy 3: strip the last hyphen-segment (URL slug often appends the outcome)
  // e.g. "KXATPMATCH-26FEB18SVAT-IA" → try event "KXATPMATCH-26FEB18SVAT"
  const parts = ticker.split("-");
  if (parts.length > 1) {
    const eventGuess = parts.slice(0, -1).join("-");
    try {
      const eResp = await fetch(`${KALSHI_BASE}/events/${eventGuess}?with_nested_markets=true`);
      if (eResp.ok) {
        const eData = await eResp.json() as { event: any };
        const result = resultFromEvent(eData.event ?? {});
        if (result) return result;
      }
    } catch {}
  }

  // Strategy 4: search all open events for any market whose ticker matches
  // (normalised: strip hyphens and compare case-insensitively)
  const normalised = ticker.replace(/-/g, "").toLowerCase();
  try {
    const params = new URLSearchParams({ status: "open", limit: "200", with_nested_markets: "true" });
    const searchResp = await fetch(`${KALSHI_BASE}/events?${params}`);
    if (searchResp.ok) {
      const searchData = await searchResp.json() as { events: any[] };
      for (const event of searchData.events) {
        const markets: any[] = event.markets ?? [];
        // Check if any market ticker normalises to our ticker
        const hit = markets.find((m: any) =>
          m.ticker?.replace(/-/g, "").toLowerCase() === normalised
        );
        if (hit) {
          const result = resultFromEvent(event);
          if (result) return result;
        }
        // Also check if the event ticker itself normalises to our ticker
        if (event.event_ticker?.replace(/-/g, "").toLowerCase() === normalised) {
          const result = resultFromEvent(event);
          if (result) return result;
        }
      }
    }
  } catch {}

  throw new Error(
    `Could not find market "${ticker}" on Kalshi. ` +
    `Check that you copied the URL from an active market page on kalshi.com.`
  );
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

interface TradeStreamInterface {
  subscribe(tickers: string[]): void;
  addListener(fn: (entry: KalshiTradeEntry) => void): () => void;
}

/** Push a PnL snapshot to every connected dashboard. */
function broadcastPnlToDashboards(clients: Map<WebSocket, ClientInfo>, pnl: PnLTracker): void {
  const snap = pnl.getSnapshot();
  const msg: BotMessage = {
    type: "pnl",
    data: {
      totalSpent: snap.totalSpent,
      totalReceived: snap.totalReceived,
      totalFees: snap.totalFees,
      realizedPnl: snap.realizedPnl,
      unrealizedPnl: snap.unrealizedPnl,
      openPositions: snap.positions.length,
      tradeCount: snap.tradeCount,
      timestamp: Date.now(),
    },
  };
  const payload = JSON.stringify(msg);
  for (const [ws, info] of clients) {
    if (info.type === "dashboard" && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/** Send a clients_update message to every connected dashboard. */
function broadcastClientsUpdate(
  clients: Map<WebSocket, ClientInfo>,
  disconnectedPhones: Map<string, ClientInfo>,
): void {
  const connectedPhones = [...clients.values()].filter((c) => c.type === "phone");
  const msg: BotMessage = {
    type: "clients_update",
    data: [
      ...connectedPhones.map((c) => ({
        id: c.id,
        connectedAt: c.connectedAt,
        activeMarket: c.activeMarket,
        label: c.label,
        connected: true,
      })),
      ...[...disconnectedPhones.values()].map((c) => ({
        id: c.id,
        connectedAt: c.connectedAt,
        activeMarket: c.activeMarket,
        label: c.label,
        connected: false,
      })),
    ],
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
  realTradingBackend: TradingBackend,
  simTradingBackend: TradingBackend,
  pnl: PnLTracker,
  priceCache?: TickerSubscriber,
  tradeStream?: TradeStreamInterface,
): WebSocketServer {
  // Per-connection state map
  const clients = new Map<WebSocket, ClientInfo>();

  // Stream every log line to connected dashboard clients.
  addLogListener((line) => {
    const msg: BotMessage = { type: "log", data: line };
    const payload = JSON.stringify(msg);
    for (const [ws, info] of clients) {
      if (info.type === "dashboard" && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  });

  // Stream live Kalshi order-feed entries to dashboards and persist own trades.
  if (tradeStream) {
    tradeStream.addListener((entry) => {
      // Persist own-trade entries so all devices see chart dots after connect.
      if (entry.isOwn) dataStore.upsertOwnFeedEntry(entry);
      const msg: BotMessage = { type: "kalshi_order_feed", data: entry };
      const payload = JSON.stringify(msg);
      for (const [ws, info] of clients) {
        if (info.type === "dashboard" && ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    });
  }

  // Persistent store — survives page refreshes and is shared across all devices.
  const dataStore = new DataStore(config.defaultBuySize);

  // Last market set by the dashboard — re-sent to any phone that (re)connects.
  const globalMarket: { current: MarketConfig | null } = { current: null };

  // Phones that have disconnected — kept visible in the dashboard with a "disconnected"
  // badge until the phone reconnects (matched by label) or the server restarts.
  const disconnectedPhones = new Map<string, ClientInfo>();

  // Mutable trading backend — swapped when phone toggles test mode.
  const tradingRef: { current: TradingBackend } = {
    current: config.testMode ? simTradingBackend : realTradingBackend,
  };

  // Default buy size — initialised from persisted DataStore value.
  const defaultTradeSizeRef = { current: dataStore.getDefaultTradeSize() };

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

    // Lookup market by ticker — resolves a Kalshi ticker to home/away tickers
    if (req.method === "GET" && req.url?.startsWith("/lookup-market")) {
      const urlObj = new URL(req.url, "http://localhost");
      const ticker = (urlObj.searchParams.get("ticker") ?? "").toUpperCase().trim();
      if (!ticker) {
        res.writeHead(400, { "Content-Type": "application/json", ...CORS });
        res.end(JSON.stringify({ error: "ticker is required" }));
        return;
      }
      lookupKalshiMarket(ticker)
        .then((result) => {
          res.writeHead(200, { "Content-Type": "application/json", ...CORS });
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.writeHead(404, { "Content-Type": "application/json", ...CORS });
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
        await handleMessage(ws, wss, clients, disconnectedPhones, message, config, client, walletAddress, tradingRef, realTradingBackend, simTradingBackend, pnl, priceCache, tradeStream, globalMarket, defaultTradeSizeRef, dataStore);
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
      // Keep phone card visible with a "disconnected" badge instead of removing it.
      if (info?.type === "phone") {
        disconnectedPhones.set(info.id, info);
        broadcastClientsUpdate(clients, disconnectedPhones);
      }
    });

    ws.on("error", (err) => log.error("Socket error", err));
  });

  // Poll price history every 30 s so live candles stream into connected dashboards
  // without requiring a page refresh. Skips when no dashboard is watching or no
  // market is configured.
  setInterval(() => {
    const hasDashboard = [...clients.values()].some(c => c.type === "dashboard");
    if (!hasDashboard) return;
    const market =
      globalMarket.current ??
      [...clients.values()].find(
        c => c.type === "phone" && c.activeMarket?.homeKalshiTicker,
      )?.activeMarket ??
      null;
    if (market?.homeKalshiTicker || market?.awayKalshiTicker) {
      fetchAndBroadcastPriceHistory(clients, market, client);
    }
  }, 30_000);

  return wss;
}

// ============================================================
// Message Router
// ============================================================

async function handleMessage(
  ws: WebSocket,
  wss: WebSocketServer,
  clients: Map<WebSocket, ClientInfo>,
  disconnectedPhones: Map<string, ClientInfo>,
  message: AppMessage,
  config: Config,
  client: any,
  walletAddress: string,
  tradingRef: { current: TradingBackend },
  realTradingBackend: TradingBackend,
  simTradingBackend: TradingBackend,
  pnl: PnLTracker,
  priceCache: TickerSubscriber | undefined,
  tradeStream: TradeStreamInterface | undefined,
  globalMarket: { current: MarketConfig | null },
  defaultTradeSizeRef: { current: number },
  dataStore: DataStore,
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
      if (message.data.clientType === "phone") {
        // Remove from disconnected list if this phone is reconnecting with a known label.
        const reconnectLabel = message.data.label ?? senderInfo?.label;
        if (reconnectLabel) {
          for (const [dId, dInfo] of disconnectedPhones) {
            if (dInfo.label === reconnectLabel) {
              disconnectedPhones.delete(dId);
              break;
            }
          }
        }
        // Re-send last dashboard-configured market so phone restores state after refresh.
        if (globalMarket.current) {
          if (senderInfo) senderInfo.activeMarket = globalMarket.current;
          send(ws, { type: "market_configured", data: globalMarket.current });
          log.info(`Re-sent last market to reconnecting phone ${senderInfo?.id}`);
        }
      }
      // Send this dashboard the current phone list, full history, and restore price history.
      if (message.data.clientType === "dashboard") {
        const phones = [...clients.values()].filter((c) => c.type === "phone");
        send(ws, {
          type: "clients_update",
          data: [
            ...phones.map((c) => ({
              id: c.id,
              connectedAt: c.connectedAt,
              activeMarket: c.activeMarket,
              label: c.label,
              connected: true,
            })),
            ...[...disconnectedPhones.values()].map((c) => ({
              id: c.id,
              connectedAt: c.connectedAt,
              activeMarket: c.activeMarket,
              label: c.label,
              connected: false,
            })),
          ],
        });
        // Send full persisted state so all devices share the same history.
        const { trades, ownFeed, defaultTradeSize } = dataStore.getState();
        send(ws, { type: "dashboard_state", data: { trades, ownFeed, defaultTradeSize } });
        // Re-send price history so the chart loads even after a page refresh.
        const market =
          globalMarket.current ??
          phones.find((p) => p.activeMarket?.homeKalshiTicker)?.activeMarket ??
          null;
        if (market?.homeKalshiTicker || market?.awayKalshiTicker) {
          fetchAndBroadcastPriceHistory(clients, market, client, ws);
        }
      }
      // Tell all dashboards the updated roster
      broadcastClientsUpdate(clients, disconnectedPhones);
      return;
    }

    // ----------------------------------------------------------
    // Rename a phone client (dashboard → bot → phone)
    // ----------------------------------------------------------
    case "rename_client": {
      const { clientId, label } = message.data;
      for (const [targetWs, targetInfo] of clients) {
        if (targetInfo.id === clientId) {
          targetInfo.label = label;
          // Tell the phone its new label so it can persist it in localStorage.
          send(targetWs, { type: "set_label", data: { label } });
          log.info(`Renamed client ${clientId} → "${label}"`);
          break;
        }
      }
      broadcastClientsUpdate(clients, disconnectedPhones);
      return;
    }

    // ----------------------------------------------------------
    // Configure Market for a specific phone (dashboard → bot → phone)
    // ----------------------------------------------------------
    case "configure_client_market": {
      const { clientId, market } = message.data;
      // Remember globally so reconnecting phones get it automatically.
      globalMarket.current = market;
      for (const [targetWs, targetInfo] of clients) {
        if (targetInfo.id === clientId) {
          targetInfo.activeMarket = market;
          if (market.homeKalshiTicker || market.awayKalshiTicker) {
            const tickers = [...new Set([market.homeKalshiTicker, market.awayKalshiTicker].filter(Boolean) as string[])];
            if (priceCache) { priceCache.subscribe(tickers); log.info(`Price cache subscribing to: ${tickers.join(", ")}`); }
            if (tradeStream) { tradeStream.subscribe(tickers); log.info(`Trade stream subscribing to: ${tickers.join(", ")}`); }
            // Fetch and broadcast price history for both teams
            fetchAndBroadcastPriceHistory(clients, market, client);
          }
          send(targetWs, { type: "market_configured", data: market });
          log.info(`Market configured for client ${clientId}: ${JSON.stringify(market)}`);
          break;
        }
      }
      broadcastClientsUpdate(clients, disconnectedPhones);
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
      if (market.homeKalshiTicker || market.awayKalshiTicker) {
        const tickers = [...new Set([market.homeKalshiTicker, market.awayKalshiTicker].filter(Boolean) as string[])];
        if (priceCache) { priceCache.subscribe(tickers); log.info(`Price cache subscribing to: ${tickers.join(", ")}`); }
        if (tradeStream) { tradeStream.subscribe(tickers); log.info(`Trade stream subscribing to: ${tickers.join(", ")}`); }
        // Fetch and broadcast price history for both teams
        fetchAndBroadcastPriceHistory(clients, market, client);
      }
      send(ws, { type: "market_configured", data: market });
      if (senderInfo?.type === "phone") {
        broadcastClientsUpdate(clients, disconnectedPhones);
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
      const buySize = size ?? defaultTradeSizeRef.current;

      log.info(`BUY signal — team=${team}  size=$${buySize}  token=${tokenId}`);

      // Notify all clients the order is in-flight.
      broadcast(wss, pendingUpdate("buy", team));

      const isSim = tradingRef.current === simTradingBackend;
      const result = await tradingRef.current.executeBuy(client, config, tokenId, buySize);

      const buyTs = Date.now();
      if (result.success && result.size) {
        pnl.recordBuy(tokenId, team, result.size, result.price ?? 0, result.fee ?? 0);
        const storedBuy: StoredTrade = {
          id: `${buyTs}-${Math.random().toString(36).slice(2, 6)}`,
          action: "buy",
          team,
          contracts: result.size,
          price: result.price ?? 0,
          fee: result.fee,
          latencyMs: result.latencyMs,
          marketDesc: activeMarket.description,
          homeTitle: activeMarket.homeTitle,
          awayTitle: activeMarket.awayTitle,
          platform: "kalshi",
          timestamp: buyTs,
          sim: isSim,
        };
        dataStore.addTrade(storedBuy);
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
          fee: result.fee,
          timestamp: buyTs,
          latencyMs: result.latencyMs,
          error: result.error,
          sim: isSim,
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
      const sellSize = message.data.size ?? 0;
      const tokenId = getTradeId(activeMarket, team);

      // Always pass size=0 when the phone sends 0 ("sell all").
      // executeSell will fetch the real open position from the exchange API,
      // which is the ground truth — the P&L tracker may be stale (GTC buys
      // that haven't filled yet, bot restarts, manual trades, etc.).
      log.info(`SELL signal — team=${team}  size=${sellSize || "all (fetching from API)"}  token=${tokenId}`);

      broadcast(wss, pendingUpdate("sell", team));

      const isSim = tradingRef.current === simTradingBackend;
      const result = await tradingRef.current.executeSell(client, config, tokenId, sellSize, price);

      const sellTs = Date.now();
      let tradePnl: number | undefined;
      if (result.success && result.price && result.size) {
        const pnlResult = pnl.recordSell(tokenId, result.size, result.price, result.fee ?? 0);
        if (pnlResult != null) tradePnl = pnlResult;
        pnl.printSummary();
        broadcastPnlToDashboards(clients, pnl);
        const storedSell: StoredTrade = {
          id: `${sellTs}-${Math.random().toString(36).slice(2, 6)}`,
          action: "sell",
          team,
          contracts: result.size,
          price: result.price,
          fee: result.fee,
          latencyMs: result.latencyMs,
          marketDesc: activeMarket.description,
          homeTitle: activeMarket.homeTitle,
          awayTitle: activeMarket.awayTitle,
          platform: "kalshi",
          timestamp: sellTs,
          sim: isSim,
          tradePnl,
        };
        dataStore.addTrade(storedSell);
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
          fee: result.fee,
          timestamp: sellTs,
          latencyMs: result.latencyMs,
          error: result.error,
          sim: isSim,
          tradePnl,
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
      send(ws, {
        type: "pnl",
        data: {
          totalSpent: snap.totalSpent,
          totalReceived: snap.totalReceived,
          totalFees: snap.totalFees,
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

    // ----------------------------------------------------------
    // Toggle test / real mode at runtime
    // ----------------------------------------------------------
    case "set_test_mode": {
      const enable = message.data.enabled;
      config.testMode = enable;
      tradingRef.current = enable ? simTradingBackend : realTradingBackend;
      log.info(`Test mode ${enable ? "ON" : "OFF"}`);
      // Broadcast updated status to every connected client.
      const statusPayload = JSON.stringify({
        type: "status",
        data: {
          connected: true,
          walletAddress,
          market: null,
          testMode: config.testMode,
          timestamp: Date.now(),
        },
      } satisfies BotMessage);
      for (const [targetWs] of clients) {
        if (targetWs.readyState === WebSocket.OPEN) targetWs.send(statusPayload);
      }
      return;
    }

    // ----------------------------------------------------------
    // Set Default Trade Size  (dashboard → bot)
    // ----------------------------------------------------------
    case "set_default_size": {
      const { size } = message.data;
      if (typeof size === "number" && size > 0) {
        defaultTradeSizeRef.current = size;
        dataStore.setDefaultTradeSize(size);
        log.info(`Default trade size set to $${size}`);
      }
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
