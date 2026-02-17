import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";
import { Config } from "../config";
import { createLogger } from "../logger";

const log = createLogger("PolyClient");

export interface PolymarketClient {
  clob: ClobClient;
  wallet: Wallet;
  address: string;
}

/**
 * Initialise the Polymarket CLOB client.
 *
 * If API credentials are present in the config they are used directly.
 * Otherwise the bot derives new API keys from the wallet and logs them
 * so the user can persist them in `.env` for subsequent runs.
 */
export async function initializeClient(
  config: Config,
): Promise<PolymarketClient> {
  log.info("Initializing Polymarket client…");

  const wallet = new Wallet(config.privateKey);
  const address = await wallet.getAddress();
  log.info(`Wallet address: ${address}`);

  let clob: ClobClient;

  if (config.apiKey && config.apiSecret && config.apiPassphrase) {
    clob = new ClobClient(config.clobApiUrl, config.chainId, wallet, {
      key: config.apiKey,
      secret: config.apiSecret,
      passphrase: config.apiPassphrase,
    });
    log.info("CLOB client initialized with existing API keys");
  } else {
    clob = new ClobClient(config.clobApiUrl, config.chainId, wallet);
    log.info("No API keys found — deriving new keys from wallet…");

    try {
      const creds = await clob.deriveApiKey();
      log.info(
        "API keys derived. Add the following to your .env so the " +
          "bot doesn't re-derive on every start:",
      );
      console.log(`  CLOB_API_KEY=${creds.key}`);
      console.log(`  CLOB_API_SECRET=${creds.secret}`);
      console.log(`  CLOB_API_PASSPHRASE=${creds.passphrase}`);

      // Re-init with the fresh credentials
      clob = new ClobClient(config.clobApiUrl, config.chainId, wallet, creds);
    } catch (err) {
      log.error("Failed to derive API keys", err);
      throw new Error(
        "Could not derive Polymarket API keys. " +
          "Ensure your wallet has interacted with Polymarket at least once.",
      );
    }
  }

  return { clob, wallet, address };
}
