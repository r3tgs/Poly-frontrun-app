import { loadConfig } from "./config";
import { initializeClient } from "./polymarket/client";
import { startWebSocketServer } from "./ws/server";
import { createLogger, setLogLevel, LogLevel } from "./logger";

const log = createLogger("Main");

async function main(): Promise<void> {
  log.info("Starting Polymarket Trading Bot…");

  // 1. Config
  const config = loadConfig();
  if (process.env.LOG_LEVEL === "debug") {
    setLogLevel(LogLevel.DEBUG);
  }
  log.info(`Chain ${config.chainId}  |  WS port ${config.wsPort}`);

  // 2. Polymarket client
  const client = await initializeClient(config);
  log.info(`Wallet ready: ${client.address}`);

  // 3. WebSocket server
  const wss = startWebSocketServer(config, client);

  // 4. Graceful shutdown
  const shutdown = () => {
    log.info("Shutting down…");
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
