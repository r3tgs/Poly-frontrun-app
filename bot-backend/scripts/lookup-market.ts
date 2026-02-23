/**
 * Lookup Polymarket market token IDs by searching for a market question.
 *
 * Usage:
 *   npx tsx scripts/lookup-market.ts "aliens exist before 2027"
 *   npx tsx scripts/lookup-market.ts aliens              # single keyword
 *   npx tsx scripts/lookup-market.ts --all "aliens"      # skip relevance filter
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

/** Score how well a market question matches the search keywords (0-1). */
function relevanceScore(question: string, keywords: string[]): number {
  const q = question.toLowerCase();
  let matched = 0;
  for (const kw of keywords) {
    if (q.includes(kw.toLowerCase())) matched++;
  }
  return keywords.length > 0 ? matched / keywords.length : 0;
}

/** Stop-words that don't help distinguish markets. */
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "will", "be", "to", "of", "in", "on",
  "for", "and", "or", "by", "at", "it", "do", "does", "did", "has", "have",
  "this", "that", "with", "from", "before", "after", "not", "no", "yes",
]);

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

async function fetchMarkets(query: string): Promise<GammaMarket[]> {
  // Fetch more results so we have room to filter client-side
  const url = `${GAMMA_API}/markets?closed=false&limit=50&_q=${encodeURIComponent(query)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`API error: ${resp.status} ${resp.statusText}`);
    return [];
  }
  return resp.json();
}

function printMarket(market: GammaMarket) {
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

async function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes("--all");
  const query = args.filter((a) => a !== "--all").join(" ").trim();

  if (!query) {
    console.error("Usage: npx tsx scripts/lookup-market.ts <search query>");
    console.error('Example: npx tsx scripts/lookup-market.ts "aliens exist before 2027"');
    console.error("        npx tsx scripts/lookup-market.ts --all aliens");
    process.exit(1);
  }

  console.log(`Searching Polymarket for: "${query}"\n`);

  const allMarkets = await fetchMarkets(query);

  if (allMarkets.length === 0) {
    console.log("No markets found. Try a different search query.");
    process.exit(0);
  }

  const keywords = extractKeywords(query);

  // Score and sort by relevance
  const scored = allMarkets.map((m) => ({
    market: m,
    score: relevanceScore(m.question, keywords),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Filter: require at least 1 keyword match, unless --all
  const MIN_SCORE = showAll ? 0 : 1 / Math.max(keywords.length, 1);
  const relevant = scored.filter((s) => s.score >= MIN_SCORE);

  if (relevant.length === 0) {
    console.log("No relevant markets found for your query.");
    console.log(`\nThe API returned ${allMarkets.length} results but none matched your keywords.`);
    console.log("Top API results were:");
    for (const m of allMarkets.slice(0, 3)) {
      console.log(`  - ${m.question}`);
    }
    console.log('\nTip: Try broader keywords, or use --all to see all API results.');
    process.exit(0);
  }

  // Show up to 10 relevant results
  const display = relevant.slice(0, 10);
  console.log(`Found ${relevant.length} relevant market(s) (showing top ${display.length}):\n`);

  for (const { market, score } of display) {
    printMarket(market);
  }

  // Print copy-paste config for the best match
  const best = display[0].market;
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
