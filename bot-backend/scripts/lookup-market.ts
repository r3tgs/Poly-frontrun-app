/**
 * Lookup Polymarket market token IDs by searching for a market question.
 *
 * Usage:
 *   npx tsx scripts/lookup-market.ts "aliens exist before 2027"
 *
 * Prints the condition ID, YES token ID, and NO token ID needed
 * for the bot's market configuration.
 */

const GAMMA_API = "https://gamma-api.polymarket.com";

interface GammaMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
  }>;
  outcomePrices: string;
  volume: string;
  active: boolean;
}

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error("Usage: npx tsx scripts/lookup-market.ts <search query>");
    console.error('Example: npx tsx scripts/lookup-market.ts "aliens exist before 2027"');
    process.exit(1);
  }

  console.log(`Searching Polymarket for: "${query}"\n`);

  const url = `${GAMMA_API}/markets?closed=false&limit=10&_q=${encodeURIComponent(query)}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    console.error(`API error: ${resp.status} ${resp.statusText}`);
    process.exit(1);
  }

  const markets: GammaMarket[] = await resp.json();

  if (markets.length === 0) {
    console.log("No markets found. Try a different search query.");
    process.exit(0);
  }

  for (const market of markets) {
    console.log("=".repeat(60));
    console.log(`Question: ${market.question}`);
    console.log(`Condition ID: ${market.conditionId}`);
    console.log(`Active: ${market.active}`);
    console.log(`Volume: $${parseFloat(market.volume).toLocaleString()}`);

    if (market.tokens && market.tokens.length > 0) {
      for (const token of market.tokens) {
        console.log(
          `  ${token.outcome.toUpperCase()} token: ${token.token_id}  (price: ${token.price})`,
        );
      }
    }
    console.log();
  }

  // Print copy-paste config for the first result
  const best = markets[0];
  if (best.tokens && best.tokens.length >= 2) {
    const yesToken = best.tokens.find((t) => t.outcome.toLowerCase() === "yes");
    const noToken = best.tokens.find((t) => t.outcome.toLowerCase() === "no");

    if (yesToken && noToken) {
      console.log("=".repeat(60));
      console.log("COPY-PASTE CONFIG for useBotConnection hook:\n");
      console.log(`  conditionId: '${best.conditionId}',`);
      console.log(`  homeTokenId: '${yesToken.token_id}',  // YES`);
      console.log(`  awayTokenId: '${noToken.token_id}',  // NO`);
      console.log(`  description: '${best.question}',`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
