import { createPublicClient, http, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import type { Market, PairConfig } from "@looping-tool/shared";
import { getProxyFetch } from "../proxy.js";

// Aave V3 Ethereum UiPoolDataProviderV3
const UI_POOL_DATA_PROVIDER = "0x3F78BBD206e4D3c504Eb854232EdA7e47E9Fd8FC" as const;
// Aave V3 Ethereum PoolAddressesProvider
const POOL_ADDRESSES_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e" as const;

const RAY = 1e27;
const RAY_BI = 10n ** 27n;

// Full ABI for getReservesData — matches the deployed UiPoolDataProviderV3 at
// 0x3F78BBD206e4D3c504Eb854232EdA7e47E9Fd8FC (Aave V3.2 Ethereum mainnet).
// Field order and types verified from the on-chain contract source (Etherscan).
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
          // Core index & rate data
          { name: "underlyingAsset", type: "address" },
          { name: "liquidityIndex", type: "uint256" },
          { name: "variableBorrowIndex", type: "uint256" },
          { name: "liquidityRate", type: "uint256" },      // RAY, annualized supply APY
          { name: "variableBorrowRate", type: "uint256" }, // RAY, annualized borrow APY
          { name: "lastUpdateTimestamp", type: "uint256" },
          // Token addresses
          { name: "aTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          // Pricing & liquidity
          { name: "priceInMarketReferenceCurrency", type: "uint256" },
          { name: "priceOracle", type: "address" },
          { name: "availableLiquidity", type: "uint256" },
          { name: "totalScaledVariableDebt", type: "uint256" },
          // Asset metadata
          { name: "symbol", type: "string" },
          { name: "name", type: "string" },
          // Collateral & risk parameters
          { name: "baseLTVasCollateral", type: "uint256" },
          { name: "reserveLiquidationThreshold", type: "uint256" },
          { name: "reserveLiquidationBonus", type: "uint256" },
          { name: "decimals", type: "uint256" },
          { name: "reserveFactor", type: "uint256" },
          // Configuration flags
          { name: "usageAsCollateralEnabled", type: "bool" },
          { name: "isActive", type: "bool" },
          { name: "isFrozen", type: "bool" },
          { name: "borrowingEnabled", type: "bool" },
          { name: "isPaused", type: "bool" },
          // Caps
          { name: "debtCeiling", type: "uint256" },
          { name: "debtCeilingDecimals", type: "uint256" },
          { name: "borrowCap", type: "uint256" },
          { name: "supplyCap", type: "uint256" },
          // V3 feature flags
          { name: "flashLoanEnabled", type: "bool" },
          { name: "isSiloedBorrowing", type: "bool" },
          // Isolation & unbacked
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "borrowableInIsolation", type: "bool" },
          // V3.2 virtual balance
          { name: "virtualAccActive", type: "bool" },
          { name: "virtualUnderlyingBalance", type: "uint128" },
        ],
      },
      {
        name: "",
        type: "tuple",
        components: [
          { name: "networkBaseTokenPriceInUsd", type: "int256" },
          { name: "networkBaseTokenPriceDecimals", type: "uint256" },
          { name: "marketReferenceCurrencyUnit", type: "uint256" },
          { name: "marketReferenceCurrencyPriceInUsd", type: "int256" },
        ],
      },
    ],
  },
] as const;

interface AaveReserve {
  underlyingAsset: string;
  symbol: string;
  decimals: bigint;           // uint8 on-chain, decoded as bigint by viem
  baseLTVasCollateral: bigint;
  reserveLiquidationThreshold: bigint;
  variableBorrowRate: bigint; // uint256, in RAY (1e27) — already annualized
  liquidityRate: bigint;      // uint256, in RAY (1e27) — already annualized
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
  // Divide by RAY using BigInt to avoid JS float overflow, then convert to number.
  // variableBorrowRate is in RAY (1e27), already annualized.
  const borrowAPY = Number((borrowReserve.variableBorrowRate * 10000n) / RAY_BI) / 10000;
  const decimals = Number(borrowReserve.decimals);
  // Use BigInt integer division to avoid JS float overflow on large token amounts.
  const decBI = 10n ** BigInt(decimals);
  const toBorrowTokens = (v: bigint) => Number(v / decBI) + Number(v % decBI) / 10 ** decimals;

  const availLiqTokens = toBorrowTokens(borrowReserve.availableLiquidity);

  // NOTE: availableLiquidity is in token units, not USD.
  // For current stablecoin-only scope this is ~equivalent to USD.
  // To support non-dollar assets, multiply by priceInMarketReferenceCurrency.
  const availableLiquidity = availLiqTokens;

  // NOTE: totalScaledVariableDebt is pre-index, so utilization is approximate.
  // For accurate utilization, multiply by variableBorrowIndex / RAY.
  const scaledDebt = toBorrowTokens(borrowReserve.totalScaledVariableDebt ?? 0n);
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
      transport: http(rpcUrl, { fetchOptions: {}, fetch: getProxyFetch() }),
    });

    const [reserves] = await client.readContract({
      address: UI_POOL_DATA_PROVIDER,
      abi: UI_POOL_ABI,
      functionName: "getReservesData",
      args: [POOL_ADDRESSES_PROVIDER],
      gas: 30_000_000n,
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
