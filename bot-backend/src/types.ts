// ============================================================
// Market Configuration
// ============================================================

/**
 * Maps a market to home/away outcomes.
 *
 * Populate the CLOB fields for platform="polymarket",
 * or the US fields for platform="polymarket-us".
 * Both sets can coexist so the same config works with either platform.
 */
export interface MarketConfig {
  // ---- Original Polymarket CLOB (platform="polymarket") ----
  /** Polymarket condition ID */
  conditionId?: string;
  /** Token ID for the "home" outcome */
  homeTokenId?: string;
  /** Token ID for the "away" outcome */
  awayTokenId?: string;

  // ---- Polymarket US (platform="polymarket-us") ----
  /** Market slug for the "home" outcome (e.g. "us-iran-yes-feb-28-2026") */
  homeMarketSlug?: string;
  /**
   * Market slug for the "away" outcome.
   * For binary Yes/No markets this is a different slug from homeMarketSlug.
   * For sports moneyline markets this is the SAME slug as homeMarketSlug —
   * set awayIsShort=true so the bot uses BUY_SHORT for the away side.
   */
  awayMarketSlug?: string;
  /**
   * Set to true for sports moneyline markets where both sides share one slug.
   * When true the bot uses BUY_SHORT / SELL_SHORT for the away team.
   * Leave false (default) for binary Yes/No markets with separate slugs.
   */
  awayIsShort?: boolean;

  // ---- Kalshi (platform="kalshi") ----
  /**
   * Kalshi ticker for the "home" outcome (e.g. "NBA-2026-LAL").
   * If homeKalshiTicker === awayKalshiTicker it is a binary market:
   *   home=YES, away=NO on the same ticker.
   * If they differ, each team has its own ticker and both buy YES.
   */
  homeKalshiTicker?: string;
  /** Kalshi ticker for the "away" outcome. */
  awayKalshiTicker?: string;

  // ---- Common ----
  /** Human-readable label, e.g. "Stars vs Rangers" */
  description?: string;
  /** Human-readable name for the home team / outcome */
  homeTitle?: string;
  /** Human-readable name for the away team / outcome */
  awayTitle?: string;
}

// ============================================================
// WebSocket Messages — App → Bot
// ============================================================

export type AppMessage =
  | ConfigureMarketMessage
  | BuySignalMessage
  | SellMessage
  | StatusRequestMessage
  | PnlRequestMessage
  | RegisterMessage
  | ConfigureClientMarketMessage
  | RenameClientMessage
  | SetTestModeMessage
  | SetDefaultSizeMessage;

/** Set the active market before sending trade signals. */
export interface ConfigureMarketMessage {
  type: "configure_market";
  data: MarketConfig;
}

/** User pressed a score button — triggers a buy. */
export interface BuySignalMessage {
  type: "signal";
  data: {
    team: "home" | "away";
    /** Override the default USDC buy size */
    size?: number;
  };
}

/** User manually triggers a sell. */
export interface SellMessage {
  type: "sell";
  data: {
    team: "home" | "away";
    /** Number of contracts to sell */
    size: number;
    /** Limit price — omit to sell at best bid */
    price?: number;
  };
}

/** Request current bot status. */
export interface StatusRequestMessage {
  type: "status";
}

/** Identify this connection as a phone or dashboard. */
export interface RegisterMessage {
  type: "register";
  data: { clientType: "phone" | "dashboard"; label?: string };
}

/** Dashboard → bot: configure the market for one specific connected phone. */
export interface ConfigureClientMarketMessage {
  type: "configure_client_market";
  data: { clientId: string; market: MarketConfig };
}

/** Dashboard → bot: rename a connected phone. */
export interface RenameClientMessage {
  type: "rename_client";
  data: { clientId: string; label: string };
}

/** Request current P&L summary (test mode). */
export interface PnlRequestMessage {
  type: "pnl";
}

/** Phone → bot: switch between simulated and real trading at runtime. */
export interface SetTestModeMessage {
  type: "set_test_mode";
  data: { enabled: boolean };
}

/** Dashboard → bot: override the default buy size (USD) for all future signals. */
export interface SetDefaultSizeMessage {
  type: "set_default_size";
  data: { size: number };
}

// ============================================================
// WebSocket Messages — Bot → App
// ============================================================

// ============================================================
// Kalshi Live Order Feed
// ============================================================

export interface KalshiTradeEntry {
  tradeId: string;
  ticker: string;
  count: number;
  /** YES price in cents (1–99). NO price = 100 - yesPrice. */
  yesPrice: number;
  takerSide: "yes" | "no";
  /** Unix ms — parsed from Kalshi's created_time ISO string. */
  timestamp: number;
  /** True when this trade_id was confirmed as ours via the private fill channel. */
  isOwn: boolean;
  /** Only set when isOwn=true. */
  action?: "buy" | "sell";
  /** Our side from the fill channel (may differ from takerSide when we're the maker). */
  ownSide?: "yes" | "no";
}

export interface PricePoint {
  /** Unix ms */
  ts: number;
  /** YES price in cents (1–99) */
  price: number;
}

export interface PriceHistoryMessage {
  type: "price_history";
  data: {
    homeTicker: string;
    awayTicker: string;       // equals homeTicker for binary markets
    homePoints: PricePoint[];
    awayPoints: PricePoint[]; // empty for binary — frontend derives as 100 - homePrice
  };
}

// ============================================================
// Stored Trade (persisted server-side, matches frontend TradeEntry)
// ============================================================

export interface StoredTrade {
  id: string;
  action: "buy" | "sell";
  team: "home" | "away";
  contracts: number;
  /** Gross fill price in dollars (e.g. 0.19 = 19¢) */
  price: number;
  fee?: number;
  latencyMs?: number;
  marketDesc?: string;
  homeTitle?: string;
  awayTitle?: string;
  platform: "kalshi";
  timestamp: number;
  sim?: boolean;
  tradePnl?: number;
  /** Platform-specific token/ticker ID used for reliable FIFO P&L matching (e.g. "NBA-LAL::YES") */
  tokenId?: string;
}

/** Sent once to a dashboard immediately after it registers, carrying the full
 *  server-side history so all devices see the same state regardless of localStorage. */
export interface DashboardStateMessage {
  type: "dashboard_state";
  data: {
    trades: StoredTrade[];
    ownFeed: KalshiTradeEntry[];
    defaultTradeSize: number;
  };
}

/** Broadcast to every connected client whenever the default trade size changes. */
export interface DefaultSizeUpdateMessage {
  type: "default_size_update";
  data: { size: number };
}

export type BotMessage =
  | StatusMessage
  | TradeUpdateMessage
  | ErrorMessage
  | MarketConfiguredMessage
  | PnlMessage
  | ClientsUpdateMessage
  | SetLabelMessage
  | LogMessage
  | KalshiOrderFeedMessage
  | PriceHistoryMessage
  | DashboardStateMessage
  | DefaultSizeUpdateMessage;

export interface LogMessage {
  type: "log";
  data: {
    ts: string;
    level: string;
    context: string;
    message: string;
    timestamp: number;
  };
}

export interface StatusMessage {
  type: "status";
  data: {
    connected: boolean;
    walletAddress: string;
    market: MarketConfig | null;
    testMode: boolean;
    timestamp: number;
  };
}

export interface TradeUpdateMessage {
  type: "trade_update";
  data: {
    action: "buy" | "sell";
    team: "home" | "away";
    orderId?: string;
    status: "pending" | "filled" | "partial" | "failed";
    price?: number;
    size?: number;
    /** Exchange fee paid in USDC */
    fee?: number;
    timestamp: number;
    /** End-to-end latency from signal receipt to order post */
    latencyMs?: number;
    error?: string;
    /** True when this trade was executed by the simulated (test-mode) backend */
    sim?: boolean;
    /** Realized P&L for this individual sell trade (net proceeds minus cost basis). Only set for sells. */
    tradePnl?: number;
    /** Platform-specific token/ticker ID for FIFO P&L matching */
    tokenId?: string;
  };
}

export interface ErrorMessage {
  type: "error";
  data: {
    message: string;
    code?: string;
    timestamp: number;
  };
}

export interface MarketConfiguredMessage {
  type: "market_configured";
  data: MarketConfig;
}

/** Bot → dashboard: full list of connected phone clients and their markets. */
export interface ClientsUpdateMessage {
  type: "clients_update";
  data: Array<{
    id: string;
    connectedAt: number;
    activeMarket: MarketConfig | null;
    label?: string;
    /** True while the WebSocket is open; false after disconnect (card stays visible). */
    connected: boolean;
  }>;
}

/** Bot → phone: persist the label the dashboard assigned. */
export interface SetLabelMessage {
  type: "set_label";
  data: { label: string };
}

export interface PnlMessage {
  type: "pnl";
  data: {
    totalSpent: number;
    totalReceived: number;
    totalFees: number;
    realizedPnl: number;
    unrealizedPnl: number;
    openPositions: number;
    tradeCount: number;
    timestamp: number;
  };
}

export interface KalshiOrderFeedMessage {
  type: "kalshi_order_feed";
  data: KalshiTradeEntry;
}
