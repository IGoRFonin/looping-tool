import { createPublicClient, http, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import type { Market, PairConfig } from "@looping-tool/shared";

// Aave V3 Ethereum UiPoolDataProviderV3
const UI_POOL_DATA_PROVIDER = "0x3F78BBD206e4D3c504Eb854232EdA7e47E9Fd8FC" as const;
// Aave V3 Ethereum PoolAddressesProvider
const POOL_ADDRESSES_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e" as const;

const RAY = 1e27;

// Minimal ABI for getReservesData
const UI_POOL_ABI = [
  {
    name: "getReservesData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "provider", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "underlyingAsset", type: "address" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "decimals", type: "uint256" },
          { name: "baseLTVasCollateral", type: "uint256" },
          { name: "reserveLiquidationThreshold", type: "uint256" },
          { name: "reserveLiquidationBonus", type: "uint256" },
          { name: "reserveFactor", type: "uint256" },
          { name: "usageAsCollateralEnabled", type: "bool" },
          { name: "borrowingEnabled", type: "bool" },
          { name: "isActive", type: "bool" },
          { name: "isFrozen", type: "bool" },
          { name: "liquidityRate", type: "uint256" },
          { name: "variableBorrowRate", type: "uint256" },
          { name: "availableLiquidity", type: "uint256" },
          { name: "totalScaledVariableDebt", type: "uint256" },
          { name: "priceInMarketReferenceCurrency", type: "uint256" },
          { name: "variableRateSlope1", type: "uint256" },
          { name: "variableRateSlope2", type: "uint256" },
          { name: "baseVariableBorrowRate", type: "uint256" },
          { name: "optimalUsageRatio", type: "uint256" },
        ],
      },
      {
        name: "",
        type: "tuple",
        components: [
          { name: "marketReferenceCurrencyUnit", type: "uint256" },
          { name: "marketReferenceCurrencyPriceInUsd", type: "int256" },
          { name: "networkBaseTokenPriceInUsd", type: "int256" },
          { name: "networkBaseTokenPriceDecimals", type: "uint8" },
        ],
      },
    ],
  },
] as const;

interface AaveReserve {
  underlyingAsset: string;
  symbol: string;
  decimals: bigint;
  baseLTVasCollateral: bigint;
  reserveLiquidationThreshold: bigint;
  variableBorrowRate: bigint;
  liquidityRate: bigint;
  availableLiquidity: bigint;
  totalScaledVariableDebt: bigint;
}

/**
 * Transform Aave reserve pair into our Market type.
 * - LTV and liquidationThreshold come from the collateral reserve, in basis points (÷ 10000).
 * - Rates are in RAY (÷ 1e27).
 * - availableLiquidity is in the borrow asset's native decimals.
 */
export function transformAaveReserve(
  collateralReserve: Pick<AaveReserve, "symbol" | "underlyingAsset" | "baseLTVasCollateral" | "reserveLiquidationThreshold">,
  borrowReserve: AaveReserve,
  collateralAPY: number | null
): Market {
  const maxLTV = Number(collateralReserve.baseLTVasCollateral) / 10000;
  const liqThreshold = Number(collateralReserve.reserveLiquidationThreshold) / 10000;
  const borrowAPY = Number(borrowReserve.variableBorrowRate) / RAY;
  const decimals = Number(borrowReserve.decimals);
  const availLiqTokens = Number(borrowReserve.availableLiquidity) / 10 ** decimals;

  // NOTE: availableLiquidity is in token units, not USD.
  // For current stablecoin-only scope this is ~equivalent to USD.
  // To support non-dollar assets, multiply by priceInMarketReferenceCurrency.
  const availableLiquidity = availLiqTokens;

  // NOTE: totalScaledVariableDebt is pre-index, so utilization is approximate.
  // For accurate utilization, multiply by variableBorrowIndex / RAY.
  const scaledDebt = Number(borrowReserve.totalScaledVariableDebt ?? 0n) / 10 ** decimals;
  const utilization = scaledDebt + availLiqTokens > 0
    ? scaledDebt / (scaledDebt + availLiqTokens)
    : 0;

  return {
    protocol: "aave",
    network: "ethereum",
    collateralAsset: {
      symbol: collateralReserve.symbol,
      address: collateralReserve.underlyingAsset,
    },
    borrowAsset: {
      symbol: borrowReserve.symbol,
      address: borrowReserve.underlyingAsset,
    },
    collateralAPY,
    borrowAPY,
    maxLTV,
    liqThreshold,
    availableLiquidity,
    utilization,
  };
}

/**
 * Fetch all Aave V3 reserves from UiPoolDataProviderV3 and filter
 * to only the pairs specified in config.
 */
export async function fetchAaveMarkets(
  pairs: PairConfig[],
  yieldRates: Map<string, number | null>,
  rpcUrl: string
): Promise<{ markets: Market[]; error?: string }> {
  const aavePairs = pairs.filter((p) => p.protocol === "aave");
  if (aavePairs.length === 0) return { markets: [] };

  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });

    const [reserves] = await client.readContract({
      address: UI_POOL_DATA_PROVIDER,
      abi: UI_POOL_ABI,
      functionName: "getReservesData",
      args: [POOL_ADDRESSES_PROVIDER],
    });

    const reserveMap = new Map<string, AaveReserve>();
    for (const r of reserves) {
      reserveMap.set(r.symbol, r as unknown as AaveReserve);
    }

    const markets: Market[] = [];
    for (const pair of aavePairs) {
      const collateralReserve = reserveMap.get(pair.collateral);
      const borrowReserve = reserveMap.get(pair.borrow);
      if (!collateralReserve || !borrowReserve) continue;

      const collateralAPY = yieldRates.get(pair.collateral) ?? null;
      markets.push(transformAaveReserve(collateralReserve, borrowReserve, collateralAPY));
    }

    return { markets };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Aave fetch failed:", message);
    return { markets: [], error: "aave_fetch_failed" };
  }
}
