/**
 * Kalshi market lookup script.
 *
 * Usage:
 *   npx tsx scripts/lookup-market-kalshi.ts "lakers"
 *   npx tsx scripts/lookup-market-kalshi.ts "lakers" KXNBAGAME
 *
 * Searches open Kalshi events by keyword (optionally filtered by series ticker prefix)
 * and prints market tickers ready to paste into constants/market.ts.
 *
 * Common series ticker prefixes:
 *   KXNBAGAME  — NBA game winners
 *   KXNFLGAME  — NFL game winners
 *   KXMLBGAME  — MLB game winners
 *   KXNHLGAME  — NHL game winners
 *   (leave blank to search all events)
 *
 * No API credentials required — uses the public events endpoint.
 */

const keyword = process.argv[2]?.toLowerCase().trim() ?? "";
const seriesTicker = process.argv[3]?.trim() ?? "";

if (!keyword) {
  console.error("Usage: npx tsx scripts/lookup-market-kalshi.ts <keyword> [series_ticker_prefix]");
  console.error("  e.g. npx tsx scripts/lookup-market-kalshi.ts \"lakers\" KXNBAGAME");
  process.exit(1);
}

const BASE = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiMarket {
  ticker: string;
  title: string;
  subtitle?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
}

interface KalshiEvent {
  event_ticker: string;
  title: string;
  markets?: KalshiMarket[];
}

interface EventsResponse {
  events: KalshiEvent[];
  cursor?: string;
}

async function fetchEventPage(cursor?: string): Promise<EventsResponse> {
  const params = new URLSearchParams({ status: "open", limit: "200", with_nested_markets: "true" });
  if (seriesTicker) params.set("series_ticker", seriesTicker);
  if (cursor) params.set("cursor", cursor);
  const resp = await fetch(`${BASE}/events?${params}`);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  }
  return resp.json() as Promise<EventsResponse>;
}

async function main() {
  console.log(`\nSearching Kalshi events for: "${keyword}"${seriesTicker ? ` (series: ${seriesTicker})` : ""}\n`);

  const matches: { event: KalshiEvent; markets: KalshiMarket[] }[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const page = await fetchEventPage(cursor);
    for (const e of page.events) {
      const haystack = `${e.event_ticker} ${e.title}`.toLowerCase();
      if (haystack.includes(keyword)) {
        const markets = e.markets ?? [];
        matches.push({ event: e, markets });
      }
    }
    cursor = page.cursor;
    pages++;
  } while (cursor && pages < 30 && matches.length < 20);

  if (matches.length === 0) {
    console.log("No matching events found.");
    console.log("\nTips:");
    console.log("  • Try a team abbreviation (e.g. 'LAL', 'GSW', 'DAL')");
    console.log("  • Add a series filter: npx tsx scripts/lookup-market-kalshi.ts \"dal\" KXNBAGAME");
    console.log("  • Common series: KXNBAGAME, KXNFLGAME, KXMLBGAME, KXNHLGAME");
    return;
  }

  // Print results
  for (const { event, markets } of matches) {
    console.log(`Event  : ${event.event_ticker}`);
    console.log(`Title  : ${event.title}`);
    if (markets.length > 0) {
      console.log(`Markets:`);
      for (const m of markets) {
        const bid = m.yes_bid_dollars ?? "?";
        const ask = m.yes_ask_dollars ?? "?";
        console.log(`  ${m.ticker.padEnd(48)} bid=${bid}  ask=${ask}`);
      }
    }
    console.log("---");
  }

  // Config block
  console.log("\n--- Paste into constants/market.ts ---\n");
  const first = matches[0];
  if (first.markets.length >= 2) {
    const home = first.markets[0];
    const away = first.markets[1];
    console.log(`  // Kalshi — ${first.event.title}`);
    console.log(`  homeKalshiTicker: '${home.ticker}',`);
    console.log(`  awayKalshiTicker: '${away.ticker}',`);
  } else if (first.markets.length === 1) {
    const m = first.markets[0];
    console.log(`  // Kalshi — binary market (home=YES, away=NO)`);
    console.log(`  homeKalshiTicker: '${m.ticker}',`);
    console.log(`  awayKalshiTicker: '${m.ticker}',`);
  } else {
    console.log(`  // Event found but no nested markets. Try fetching manually:`);
    console.log(`  // GET ${BASE}/events/${first.event.event_ticker}?with_nested_markets=true`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
