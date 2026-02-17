// ============================================================
// Market Configuration
// ============================================================

/** Maps a Polymarket market to home/away team token IDs. */
export interface MarketConfig {
  /** Polymarket condition ID for this market */
  conditionId: string;
  /** Token ID for the "home" outcome (e.g., home team wins) */
  homeTokenId: string;
  /** Token ID for the "away" outcome (e.g., away team wins) */
  awayTokenId: string;
  /** Human-readable label, e.g. "Stars vs Rangers" */
  description?: string;
}

// ============================================================
// WebSocket Messages — App → Bot
// ============================================================

export type AppMessage =
  | ConfigureMarketMessage
  | BuySignalMessage
  | SellMessage
  | StatusRequestMessage;

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

// ============================================================
// WebSocket Messages — Bot → App
// ============================================================

export type BotMessage =
  | StatusMessage
  | TradeUpdateMessage
  | ErrorMessage
  | MarketConfiguredMessage;

export interface StatusMessage {
  type: "status";
  data: {
    connected: boolean;
    walletAddress: string;
    market: MarketConfig | null;
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
    timestamp: number;
    /** End-to-end latency from signal receipt to order post */
    latencyMs?: number;
    error?: string;
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
