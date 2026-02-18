/**
 * Active Polymarket market configuration.
 *
 * To get these values, run from your local machine:
 *   cd bot-backend && npx tsx scripts/lookup-market.ts "aliens exist before 2027"
 *
 * Then paste the condition ID and token IDs below.
 */
export const MARKET_CONFIG = {
  conditionId: 'PASTE_CONDITION_ID_HERE',
  homeTokenId: 'PASTE_YES_TOKEN_ID_HERE',
  awayTokenId: 'PASTE_NO_TOKEN_ID_HERE',
  description: 'Will the US confirm that aliens exist before 2027?',
};
