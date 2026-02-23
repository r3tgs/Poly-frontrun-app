/**
 * App-wide configuration.
 *
 * BOT_WS_URL: WebSocket URL of the trading bot backend.
 *
 * Production (TestFlight): set this to your Railway/cloud URL after deploying.
 *   e.g. 'wss://your-bot.railway.app'
 *
 * Local dev: override by setting DEV_BOT_WS_URL in your environment,
 *   or just change this constant temporarily while testing.
 */
export const BOT_WS_URL = 'wss://pm-frontrun-snowy-waterfall-1028.fly.dev';
