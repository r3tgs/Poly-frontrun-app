/**
 * Active market configuration.
 *
 * To find a Kalshi market, run:
 *   cd bot-backend && npx tsx scripts/lookup-market-kalshi.ts "search query"
 *
 * To find a Polymarket US market:
 *   cd bot-backend && npx tsx scripts/lookup-market-us.ts "search query"
 *
 * To find an original Polymarket CLOB market:
 *   cd bot-backend && npx tsx scripts/lookup-market.ts "search query"
 *
 * Paste the results below. All field sets can coexist — the backend
 * picks the right ones based on the PLATFORM env var.
 */
export const MARKET_CONFIG = {
  // --- Kalshi (PLATFORM=kalshi) ---
  // Leave blank — configure the market from the dashboard each session.
  homeKalshiTicker: '',
  awayKalshiTicker: '',

  // --- Polymarket US (PLATFORM=polymarket-us) ---
  homeMarketSlug: '',
  awayMarketSlug: '',
  awayIsShort: false,

  // --- Original Polymarket CLOB (PLATFORM=polymarket, non-US only) ---
  conditionId: '',
  homeTokenId: '',
  awayTokenId: '',

  description: '',
};
