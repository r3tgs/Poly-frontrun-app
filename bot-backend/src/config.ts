import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export interface Config {
  // Mode
  testMode: boolean;

  // Platform selection
  platform: "polymarket" | "polymarket-us" | "kalshi";

  // Polymarket CLOB (used when platform="polymarket")
  clobApiUrl: string;
  chainId: number;

  // Wallet (required when platform="polymarket" and not testMode)
  privateKey: string;

  // CLOB API credentials (optional on first run — bot will generate them)
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;

  // Polymarket US (used when platform="polymarket-us" and not testMode)
  keyId?: string;
  secretKey?: string;

  // Kalshi (used when platform="kalshi" and not testMode)
  kalshiKeyId?: string;
  kalshiPrivateKeyPath?: string; // path to downloaded .pem file (recommended)
  kalshiPrivateKey?: string;     // inline PEM (must be PKCS#8 or quoted in .env)

  // WebSocket
  wsPort: number;

  // Trading defaults
  defaultBuySize: number; // USD/USDC amount per buy signal
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

  const platform: "polymarket" | "polymarket-us" | "kalshi" =
    process.env.PLATFORM === "polymarket-us"
      ? "polymarket-us"
      : process.env.PLATFORM === "kalshi"
        ? "kalshi"
        : "polymarket";

  // Validate platform-specific required credentials
  if (!testMode && platform === "polymarket-us") {
    if (!process.env.POLYMARKET_KEY_ID) {
      throw new Error("Missing required env var: POLYMARKET_KEY_ID (needed for platform=polymarket-us)");
    }
    if (!process.env.POLYMARKET_SECRET_KEY) {
      throw new Error("Missing required env var: POLYMARKET_SECRET_KEY (needed for platform=polymarket-us)");
    }
  }
  if (!testMode && platform === "kalshi") {
    if (!process.env.KALSHI_KEY_ID) {
      throw new Error("Missing required env var: KALSHI_KEY_ID (needed for platform=kalshi)");
    }
    if (!process.env.KALSHI_PRIVATE_KEY_PATH && !process.env.KALSHI_PRIVATE_KEY) {
      throw new Error(
        "Missing Kalshi private key — set KALSHI_PRIVATE_KEY_PATH (path to .pem file) or KALSHI_PRIVATE_KEY",
      );
    }
  }

  return {
    testMode,
    platform,
    clobApiUrl: process.env.CLOB_API_URL || "https://clob.polymarket.com",
    chainId: parseInt(process.env.CHAIN_ID || "137", 10),
    privateKey: (testMode || platform === "polymarket-us" || platform === "kalshi")
      ? (process.env.PRIVATE_KEY || "0x_TEST_KEY")
      : requireEnv("PRIVATE_KEY"),
    apiKey: optionalEnv("CLOB_API_KEY"),
    apiSecret: optionalEnv("CLOB_API_SECRET"),
    apiPassphrase: optionalEnv("CLOB_API_PASSPHRASE"),
    keyId: optionalEnv("POLYMARKET_KEY_ID"),
    secretKey: optionalEnv("POLYMARKET_SECRET_KEY"),
    kalshiKeyId: optionalEnv("KALSHI_KEY_ID"),
    kalshiPrivateKeyPath: optionalEnv("KALSHI_PRIVATE_KEY_PATH"),
    kalshiPrivateKey: optionalEnv("KALSHI_PRIVATE_KEY"),
    wsPort: parseInt(process.env.PORT || process.env.WS_PORT || "8080", 10),
    defaultBuySize: parseFloat(process.env.DEFAULT_BUY_SIZE || "50"),
  };
}
