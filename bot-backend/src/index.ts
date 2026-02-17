import { loadConfig } from "./config";
import { initializeClient } from "./polymarket/client";
import * as realTrading from "./polymarket/trading";
import * as simTrading from "./sim/trading";
import { startWebSocketServer, TradingBackend } from "./ws/server";
import { PnLTracker } from "./pnl";
import { createLogger, setLogLevel, LogLevel } from "./logger";

const log = createLogger("Main");

async function main(): Promise<void> {
  // 1. Config
  const config = loadConfig();
  if (process.env.LOG_LEVEL === "debug") {
    setLogLevel(LogLevel.DEBUG);
  }

  if (config.testMode) {
    log.info("╔═══════════════════════════════════════════╗");
    log.info("║        TEST MODE — no real trades         ║");
    log.info("╚═══════════════════════════════════════════╝");
  } else {
    log.info("Starting Polymarket Trading Bot…");
  }

  log.info(`Chain ${config.chainId}  |  WS port ${config.wsPort}`);

  // 2. Polymarket client (skip in test mode)
  let client: any = null;
  let walletAddress = "0xTEST_WALLET";

  if (!config.testMode) {
    const pm = await initializeClient(config);
    client = pm;
    walletAddress = pm.address;
    log.info(`Wallet ready: ${walletAddress}`);
  } else {
    log.info(`Simulated wallet: ${walletAddress}`);
  }

  // 3. Pick trading backend
  const trading: TradingBackend = config.testMode ? simTrading : realTrading;

  // 4. P&L tracker (works in both modes, but most useful in test mode)
  const pnl = new PnLTracker();

  // 5. WebSocket server
  const wss = startWebSocketServer(config, client, walletAddress, trading, pnl);

  // 6. Graceful shutdown
  const shutdown = () => {
    log.info("Shutting down…");
    pnl.printSummary();
    wss.close(() => {
      log.info("Stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error("Fatal", err);
  process.exit(1);
});
