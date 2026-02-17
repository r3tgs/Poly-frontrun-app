import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export interface Config {
  // Mode
  testMode: boolean;

  // Polymarket CLOB
  clobApiUrl: string;
  chainId: number;

  // Wallet (not required in test mode)
  privateKey: string;

  // API credentials (optional on first run — bot will generate them)
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;

  // WebSocket
  wsPort: number;

  // Trading defaults
  defaultBuySize: number; // USDC amount per buy signal
  maxPrice: number; // Max price per contract (0–1 range)
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function loadConfig(): Config {
  const testMode =
    process.env.TEST_MODE === "true" || process.env.TEST_MODE === "1";

  return {
    testMode,
    clobApiUrl: process.env.CLOB_API_URL || "https://clob.polymarket.com",
    chainId: parseInt(process.env.CHAIN_ID || "137", 10),
    privateKey: testMode ? (process.env.PRIVATE_KEY || "0x_TEST_KEY") : requireEnv("PRIVATE_KEY"),
    apiKey: optionalEnv("CLOB_API_KEY"),
    apiSecret: optionalEnv("CLOB_API_SECRET"),
    apiPassphrase: optionalEnv("CLOB_API_PASSPHRASE"),
    wsPort: parseInt(process.env.WS_PORT || "8080", 10),
    defaultBuySize: parseFloat(process.env.DEFAULT_BUY_SIZE || "50"),
    maxPrice: parseFloat(process.env.MAX_PRICE || "0.95"),
  };
}
