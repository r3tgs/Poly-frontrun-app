import { PolymarketUS } from "polymarket-us";
import { Config } from "../config";
import { createLogger } from "../logger";

const log = createLogger("PolyUSClient");

export interface PolymarketUSClient {
  api: PolymarketUS;
}

/**
 * Initialise the Polymarket US client.
 *
 * Credentials (keyId + secretKey) are generated at polymarket.us/developer
 * after completing KYC in the Polymarket US iOS app.
 */
export async function initializeUSClient(
  config: Config,
): Promise<PolymarketUSClient> {
  log.info("Initializing Polymarket US client…");

  const api = new PolymarketUS({
    keyId: config.keyId!.trim(),
    secretKey: config.secretKey!.replace(/\s/g, ""),
  });

  // Verify credentials by fetching account balance
  const resp = await api.account.balances();
  const usdBalance = resp.balances.find((b) => b.currency === "USD");
  if (usdBalance) {
    log.info(
      `Account balance: $${usdBalance.currentBalance} USD  ` +
        `(buying power: $${usdBalance.buyingPower})`,
    );
  } else {
    log.warn("No USD balance found — ensure your account is funded");
  }

  return { api };
}
