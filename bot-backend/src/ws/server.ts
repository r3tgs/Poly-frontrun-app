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

export function startWebSocketServer(
  config: Config,
  client: any,
  walletAddress: string,
  trading: TradingBackend,
  pnl: PnLTracker,
): WebSocketServer {
  const wss = new WebSocketServer({ host: "0.0.0.0", port: config.wsPort });

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

  wss.on("listening", () => {
    log.info(`Listening on ws://localhost:${config.wsPort}`);
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
): Promise<MarketConfig | null> {
  switch (message.type) {
    // ----------------------------------------------------------
    // Configure Market
    // ----------------------------------------------------------
    case "configure_market": {
      const market = message.data;
      log.info("Market configured", market);
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
      const tokenId =
        team === "home"
          ? activeMarket.homeTokenId
          : activeMarket.awayTokenId;

      log.info(`BUY signal — team=${team}  token=${tokenId}`);

      // Notify all clients the order is in-flight.
      broadcast(wss, pendingUpdate("buy", team));

      const result = await trading.executeBuy(client, config, tokenId, size);

      if (result.success && result.price && result.size) {
        pnl.recordBuy(tokenId, team, result.size, result.price);
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
      const tokenId =
        team === "home"
          ? activeMarket.homeTokenId
          : activeMarket.awayTokenId;

      // size=0 means "sell all open contracts for this token"
      if (!sellSize || sellSize <= 0) {
        const snap = pnl.getSnapshot();
        const pos = snap.positions.find((p) => p.tokenId === tokenId);
        sellSize = pos ? pos.contracts : 0;
        if (sellSize <= 0) {
          send(ws, {
            type: "error",
            data: {
              message: `No open position to sell for team=${team}`,
              timestamp: Date.now(),
            },
          });
          return activeMarket;
        }
        log.info(`SELL ALL — team=${team}  contracts=${sellSize}  token=${tokenId}`);
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
