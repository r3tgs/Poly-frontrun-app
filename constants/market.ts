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
  // Run lookup-market-kalshi.ts to find tickers, then paste here.
  // Same ticker for both = binary market (home=YES, away=NO).
  // Different tickers = moneyline (each team buys YES on their own ticker).
  homeKalshiTicker: 'KXNCAAMBGAME-26FEB18CSUUNLV-CSU',
  awayKalshiTicker: 'KXNCAAMBGAME-26FEB18CSUUNLV-UNLV',

  // --- Polymarket US (PLATFORM=polymarket-us) ---
  // Run lookup-market-us.ts to get these slugs after KYC setup
  homeMarketSlug: 'aec-cbb-byu-arz-2026-02-18', // Yes market slug — fill in after running lookup script
  awayMarketSlug: 'aec-cbb-byu-arz-2026-02-18', // No market slug  — fill in after running lookup script
  awayIsShort: true,

  // --- Original Polymarket CLOB (PLATFORM=polymarket, non-US only) ---
  conditionId: '0xdeb615a52cd114e5aa27d8344ae506a72bea81f6ed13f5915f050b615a193c20',
  homeTokenId: '53878687881372296840643404422879609046161113624304869713031188462369519751462', // Yes
  awayTokenId: '7781128617775379429370059157264862153354283943832661953096847794102113820322',  // No

  description: 'US/Israel strikes Iran by Feb 28, 2026?',
};
