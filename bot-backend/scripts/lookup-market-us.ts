/**
 * Lookup Polymarket US market slugs by searching for an event.
 *
 * Usage:
 *   npx tsx scripts/lookup-market-us.ts "super bowl"
 *   npx tsx scripts/lookup-market-us.ts "iran strikes"
 *
 * Prints the config block to paste into constants/market.ts.
 * No API key required — search is public.
 */

import { PolymarketUS } from "polymarket-us";

const client = new PolymarketUS(); // public, no auth needed

async function main() {
  const args = process.argv.slice(2);
  const query = args.join(" ").trim();

  if (!query) {
    console.error("Usage: npx tsx scripts/lookup-market-us.ts <search query>");
    console.error('Example: npx tsx scripts/lookup-market-us.ts "super bowl"');
    process.exit(1);
  }

  console.log(`Searching Polymarket US for: "${query}"\n`);

  const resp = await client.search.query({ query, limit: 20, status: "active" });

  if (!resp.events || resp.events.length === 0) {
    console.log("No active events found. Try different keywords.");
    return;
  }

  console.log(`Found ${resp.events.length} event(s):\n`);

  for (const event of resp.events.slice(0, 8)) {
    console.log("=".repeat(60));
    console.log(`Event:  ${event.title}`);

    if (!event.markets || event.markets.length === 0) {
      console.log("  (no markets)");
      console.log();
      continue;
    }

    // Detect market type
    const yesMarket = event.markets.find(
      (m) => m.outcome?.toLowerCase() === "yes",
    );
    const noMarket = event.markets.find(
      (m) => m.outcome?.toLowerCase() === "no",
    );

    const isBinary = !!(yesMarket && noMarket);
    // Sports moneyline: all markets share the same slug (or there's only one)
    const isMoneyline = !isBinary && event.markets.length >= 1;

    if (isBinary) {
      // ---- Binary Yes/No market ----
      console.log(`  Type:   Binary (Yes/No)`);
      console.log(`  Yes slug: ${yesMarket!.slug}`);
      console.log(`  No  slug: ${noMarket!.slug}`);
      console.log(`\n  ── Copy-paste config for constants/market.ts ──`);
      console.log(`  homeMarketSlug: '${yesMarket!.slug}',   // Yes`);
      console.log(`  awayMarketSlug: '${noMarket!.slug}',    // No`);
      console.log(`  // awayIsShort: false,                  // (default — separate slugs)`);
      console.log(`  description: '${event.title}',`);
    } else if (isMoneyline) {
      // ---- Sports moneyline or single-slug market ----
      const m = event.markets[0];
      const slug = m.slug;
      const label = m.outcome ?? m.title ?? slug;

      // Try to find second market for the other team
      const m2 = event.markets[1];
      const label2 = m2 ? (m2.outcome ?? m2.title ?? m2.slug) : null;

      console.log(`  Type:   Moneyline / single-slug`);
      for (const mk of event.markets) {
        const lbl = mk.outcome ?? mk.title ?? mk.slug;
        console.log(`  [${lbl.padEnd(24)}]  slug: ${mk.slug}`);
      }

      if (m2 && m2.slug !== slug) {
        // Two different slugs — treat like binary
        console.log(`\n  ── Copy-paste config for constants/market.ts ──`);
        console.log(`  homeMarketSlug: '${slug}',   // ${label}`);
        console.log(`  awayMarketSlug: '${m2.slug}',   // ${label2}`);
        console.log(`  description: '${event.title}',`);
      } else {
        // Same slug for both sides — use LONG/SHORT intent
        const homeLabel = label;
        const awayLabel = label2 ?? "away team";
        console.log(`\n  ── Copy-paste config for constants/market.ts ──`);
        console.log(`  homeMarketSlug: '${slug}',   // ${homeLabel} (BUY LONG)`);
        console.log(`  awayMarketSlug: '${slug}',   // ${awayLabel} (BUY SHORT)`);
        console.log(`  awayIsShort: true,            // same slug, different sides`);
        console.log(`  description: '${event.title}',`);
      }
    }

    console.log();
  }
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
