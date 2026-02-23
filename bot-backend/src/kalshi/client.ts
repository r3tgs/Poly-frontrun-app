import { Configuration, PortfolioApi, MarketApi, OrdersApi } from "kalshi-typescript";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as https from "https";
import { Config } from "../config";
import { createLogger } from "../logger";

/**
 * Single persistent HTTPS agent shared across ALL Kalshi REST calls.
 *
 * Without this, every order opens a fresh TCP + TLS connection (~20-40 ms).
 * With keep-alive the connection is reused and the handshake cost disappears
 * after the first request, cutting latency to pure network RTT (~5-15 ms).
 */
const kalshiAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000, // TCP keep-alive probe interval
  maxSockets: 10,
  maxFreeSockets: 5,      // keep 5 idle sockets warm at all times
});

const log = createLogger("KalshiClient");

export interface KalshiClient {
  portfolio: PortfolioApi;
  markets: MarketApi;
  orders: OrdersApi;
  /** PKCS#8 PEM — needed by PriceCache for WebSocket auth signing */
  privateKeyPem: string;
  keyId: string;
}

/**
 * Convert a PKCS#1 RSA private key (BEGIN RSA PRIVATE KEY) to PKCS#8 (BEGIN PRIVATE KEY).
 * OpenSSL 3.x / Node 18+ requires PKCS#8 for RSA-PSS signing.
 */
function toPkcs8(pem: string): string {
  if (!pem.includes("BEGIN RSA PRIVATE KEY")) return pem; // already PKCS#8 or other format
  const key = crypto.createPrivateKey({ key: pem, format: "pem", type: "pkcs1" });
  return key.export({ format: "pem", type: "pkcs8" }) as string;
}

/**
 * Load the RSA private key PEM string.
 *
 * Priority:
 *   1. KALSHI_PRIVATE_KEY_PATH — path to a .pem file
 *   2. KALSHI_PRIVATE_KEY_B64  — base64-encoded PEM (best for cloud env vars, single-line)
 *   3. KALSHI_PRIVATE_KEY via raw .env parse — dotenv truncates multiline values,
 *      so we re-read the .env file directly to extract the full PEM block.
 *   4. KALSHI_PRIVATE_KEY env var as-is (works when set as a real OS env var on cloud hosts)
 */
function loadPrivateKey(config: Config): string {
  if (config.kalshiPrivateKeyPath) {
    log.info(`Loading private key from file: ${config.kalshiPrivateKeyPath}`);
    return fs.readFileSync(config.kalshiPrivateKeyPath, "utf8");
  }

  // Base64-encoded key — cleanest option for cloud deployments (no multiline quoting issues).
  const b64 = process.env.KALSHI_PRIVATE_KEY_B64;
  if (b64 && b64.trim().length > 0) {
    log.info("Loading private key from KALSHI_PRIVATE_KEY_B64");
    return Buffer.from(b64.trim(), "base64").toString("utf8");
  }

  // Re-read the raw .env to get the full multiline PEM block.
  // dotenv truncates at the first newline for unquoted values.
  const envPath = path.resolve(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    const match = raw.match(/KALSHI_PRIVATE_KEY=(-----BEGIN[\s\S]+?-----END[^\n-]+-----)/);
    if (match) {
      return match[1].trim();
    }
  }

  // Fallback: use whatever the OS env var contains (works on Fly.io / Railway where
  // secrets are injected as real env vars rather than parsed from a file).
  if (config.kalshiPrivateKey) {
    return config.kalshiPrivateKey.replace(/\\n/g, "\n");
  }

  throw new Error("No Kalshi private key found — set KALSHI_PRIVATE_KEY_PATH, KALSHI_PRIVATE_KEY_B64, or KALSHI_PRIVATE_KEY");
}

/**
 * Initialise the Kalshi client.
 *
 * Credentials are generated at kalshi.com → Account → API Keys.
 * Recommended: set KALSHI_PRIVATE_KEY_PATH to the downloaded .pem file path.
 */
export async function initializeKalshiClient(config: Config): Promise<KalshiClient> {
  log.info("Initializing Kalshi client…");

  const rawPem = loadPrivateKey(config);
  const privateKeyPem = toPkcs8(rawPem);

  const configuration = new Configuration({
    apiKey: config.kalshiKeyId!.trim(),
    privateKeyPem,
    basePath: "https://api.elections.kalshi.com/trade-api/v2",
    // Reuse the persistent keep-alive agent for every API call.
    baseOptions: { httpsAgent: kalshiAgent },
  });

  const portfolio = new PortfolioApi(configuration);
  const markets = new MarketApi(configuration);
  const orders = new OrdersApi(configuration);

  // Verify credentials by fetching account balance
  const resp = await portfolio.getBalance();
  const balanceCents = resp.data.balance;
  const portfolioCents = resp.data.portfolio_value;
  log.info(
    `Account balance: $${(balanceCents / 100).toFixed(2)} USD  ` +
      `(portfolio value: $${(portfolioCents / 100).toFixed(2)})`,
  );

  return { portfolio, markets, orders, privateKeyPem, keyId: config.kalshiKeyId!.trim() };
}
