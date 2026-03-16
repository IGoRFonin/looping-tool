/** Represents a collateral/borrow asset in a market */
export interface Asset {
  symbol: string;
  address: string;
}

/**
 * Raw market data returned by the backend.
 * All percentage values are decimals (0.0 to 1.0).
 * Example: 4% APY = 0.04, 96.5% LTV = 0.965
 */
export interface Market {
  protocol: "morpho" | "aave";
  network: "ethereum";
  collateralAsset: Asset;
  borrowAsset: Asset;
  /** Yield rate of the collateral vault token. null if unavailable. */
  collateralAPY: number | null;
  /** Borrow rate from the lending protocol (decimal). */
  borrowAPY: number;
  /** Maximum LTV for borrowing (decimal). Morpho: equals lltv. Aave: ltv from reserve config. */
  maxLTV: number;
  /** LTV at which liquidation triggers (decimal). Morpho: equals lltv. Aave: liquidationThreshold. */
  liqThreshold: number;
  /** Available liquidity in USD. */
  availableLiquidity: number;
  /** Pool utilization ratio (decimal). */
  utilization: number;
  /** Protocol-specific market identifier. Morpho: uniqueKey. Aave: not used. */
  marketId?: string;
}

/** Response from GET /api/markets */
export interface MarketsResponse {
  lastUpdated: string;
  markets: Market[];
  errors: string[];
}

/** Global filter parameters controlled by the user in the UI */
export interface FilterParams {
  /** Target LTV as decimal. null = use per-pair default (maxLTV - 0.05). */
  targetLTV: number | null;
  /** Price impact as decimal (default 0.0007 = 0.07%). */
  priceImpact: number;
  /** Flashloan fee as decimal (default 0.0009 = 0.09%). */
  flashloanFee: number;
  /** Service fee as decimal (default 0.0001 = 0.01%). */
  serviceFee: number;
}

/** Computed metrics for a single market row, calculated on the frontend */
export interface ComputedMetrics {
  effectiveLTV: number;
  leverage: number;
  netAPY: number | null;
  entryCost: number;
  breakEvenDays: number | null;
  liqBuffer: number;
}

/** Pair configuration entry for pairs.json */
export interface PairConfig {
  protocol: "morpho" | "aave";
  collateral: string;
  borrow: string;
  marketId?: string;
}

/** Vault configuration entry for vaults.json */
export interface VaultConfig {
  [symbol: string]: {
    address: string;
    standard: "ERC-4626";
  };
}
