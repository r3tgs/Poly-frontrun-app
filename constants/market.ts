/**
 * Active Polymarket market configuration.
 *
 * To get these values, run from your local machine:
 *   cd bot-backend && npx tsx scripts/lookup-market.ts "US Israel strikes Iran"
 *
 * Then paste the condition ID and token IDs below.
 */
export const MARKET_CONFIG = {
  conditionId: '0xdeb615a52cd114e5aa27d8344ae506a72bea81f6ed13f5915f050b615a193c20',
  homeTokenId: '53878687881372296840643404422879609046161113624304869713031188462369519751462', // Yes
  awayTokenId: '7781128617775379429370059157264862153354283943832661953096847794102113820322',  // No
  description: 'US/Israel strikes Iran by Feb 28, 2026?',
};
