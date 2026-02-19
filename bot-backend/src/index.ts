import { loadConfig } from "./config";
import { initializeClient } from "./polymarket/client";
import { initializeUSClient } from "./polymarket-us/client";
import { initializeKalshiClient } from "./kalshi/client";
import { PriceCache } from "./kalshi/priceCache";
import * as realTrading from "./polymarket/trading";
import * as realUSTrading from "./polymarket-us/trading";
import * as realKalshiTrading from "./kalshi/trading";
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
    log.info(`Starting Polymarket Trading Bot — platform: ${config.platform}`);
  }

  log.info(`WS port ${config.wsPort}`);

  // 2. Client + trading backend
  let client: any = null;
  let walletAddress = "0xTEST_WALLET";
  let trading: TradingBackend = simTrading;
  let kalshiCache: PriceCache | undefined;

  if (config.testMode) {
    log.info(`Simulated wallet: ${walletAddress}`);
  } else if (config.platform === "polymarket-us") {
    const pm = await initializeUSClient(config);
    client = pm;
    walletAddress = "Polymarket US";
    trading = realUSTrading;
    log.info("Polymarket US client ready");
  } else if (config.platform === "kalshi") {
    const km = await initializeKalshiClient(config);
    client = km;
    walletAddress = "Kalshi";
    trading = realKalshiTrading;
    kalshiCache = new PriceCache(km.keyId, km.privateKeyPem);
    realKalshiTrading.setPriceCache(kalshiCache);
    log.info("Kalshi client ready (price cache initialised)");
  } else {
    const pm = await initializeClient(config);
    client = pm;
    walletAddress = pm.address;
    trading = realTrading;
    log.info(`Wallet ready: ${walletAddress}`);
  }

  // 4. P&L tracker (works in both modes, but most useful in test mode)
  const pnl = new PnLTracker();

  // 5. WebSocket server
  const wss = startWebSocketServer(config, client, walletAddress, trading, pnl, kalshiCache);

  // 6. Graceful shutdown
  const shutdown = () => {
    log.info("Shutting down…");
    pnl.printSummary();
    kalshiCache?.stop();
    wss.close(() => {
      log.info("Stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  const msg = err instanceof Error
    ? err.message
    : (typeof err === "object" ? JSON.stringify(err) : String(err));
  process.stderr.write(`[FATAL] ${msg}\n`);
  // Delay exit so Fly.io log forwarder has time to flush the error.
  setTimeout(() => process.exit(1), 5000);
});
