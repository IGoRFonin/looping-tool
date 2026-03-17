import { createPublicClient, http, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import type { Market } from "@looping-tool/shared";
import { getProxyFetch } from "../proxy.js";

import { BORROW_STABLECOINS } from "../config/stablecoins.js";

// Aave V3 Ethereum UiPoolDataProviderV3
const UI_POOL_DATA_PROVIDER = "0x3F78BBD206e4D3c504Eb854232EdA7e47E9Fd8FC" as const;
// Aave V3 Ethereum PoolAddressesProvider
const POOL_ADDRESSES_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e" as const;

const RAY = 1e27;
const RAY_BI = 10n ** 27n;

// Full ABI for getReservesData — V3.2 deployed at 0x3F78BBD...
// 41 fields verified from Blockscout (stable borrow fields removed in V3.2).
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
          { name: "liquidityIndex", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "liquidityRate", type: "uint128" },
          { name: "variableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "aTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "availableLiquidity", type: "uint256" },
          { name: "totalScaledVariableDebt", type: "uint256" },
          { name: "priceInMarketReferenceCurrency", type: "uint256" },
          { name: "priceOracle", type: "address" },
          { name: "variableRateSlope1", type: "uint256" },
          { name: "variableRateSlope2", type: "uint256" },
          { name: "baseVariableBorrowRate", type: "uint256" },
          { name: "optimalUsageRatio", type: "uint256" },
          { name: "isPaused", type: "bool" },
          { name: "isSiloedBorrowing", type: "bool" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
          { name: "flashLoanEnabled", type: "bool" },
          { name: "debtCeiling", type: "uint256" },
          { name: "debtCeilingDecimals", type: "uint256" },
          { name: "borrowCap", type: "uint256" },
          { name: "supplyCap", type: "uint256" },
          { name: "borrowableInIsolation", type: "bool" },
          { name: "virtualAccActive", type: "bool" },
          { name: "virtualUnderlyingBalance", type: "uint128" },
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
  variableBorrowRate: bigint; // uint128, in RAY (1e27) — already annualized
  liquidityRate: bigint;
  availableLiquidity: bigint;
  totalScaledVariableDebt: bigint;
  borrowingEnabled: boolean;
  // eMode parameters (uint16, basis points)
  eModeLtv: number;
  eModeLiquidationThreshold: number;
}

/**
 * Transform Aave reserve pair into our Market type.
 * Uses eMode LTV/threshold when available and higher than base params.
 * - LTV and liquidationThreshold in basis points (÷ 10000).
 * - Rates are in RAY (÷ 1e27).
 * - availableLiquidity is in the borrow asset's native decimals.
 */
export function transformAaveReserve(
  collateralReserve: Pick<AaveReserve, "symbol" | "underlyingAsset" | "decimals" | "baseLTVasCollateral" | "reserveLiquidationThreshold" | "eModeLtv" | "eModeLiquidationThreshold">,
  borrowReserve: AaveReserve,
  collateralAPY: number | null
): Market {
  // Prefer eMode params when they provide higher LTV (eMode enables looping for assets like sUSDe)
  const baseLTV = Number(collateralReserve.baseLTVasCollateral);
  const eLTV = Number(collateralReserve.eModeLtv);
  const baseLiq = Number(collateralReserve.reserveLiquidationThreshold);
  const eLiq = Number(collateralReserve.eModeLiquidationThreshold);

  const maxLTV = Math.max(baseLTV, eLTV) / 10000;
  const liqThreshold = Math.max(baseLiq, eLiq) / 10000;
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
      decimals: Number(collateralReserve.decimals),
    },
    borrowAsset: {
      symbol: borrowReserve.symbol,
      address: borrowReserve.underlyingAsset,
      decimals: Number(borrowReserve.decimals),
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
 * Fetch all Aave V3 reserves and auto-discover valid looping pairs.
 * A pair is valid when collateral underlying address is in yieldVaults
 * and borrow is a stablecoin with borrowing enabled.
 */
export async function fetchAaveMarkets(
  vaultAddresses: Set<string>,
  yieldRates: Map<string, number>,
  rpcUrl: string
): Promise<{ markets: Market[]; error?: string }> {
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

    // Find all collateral reserves whose underlying address is a known yield vault
    const collateralReserves = [...reserveMap.values()]
      .filter((r) => vaultAddresses.has(r.underlyingAsset.toLowerCase()));

    // Find all borrow reserves that are active stablecoins with borrowing enabled
    const borrowReserves = [...reserveMap.entries()]
      .filter(([symbol, r]) => BORROW_STABLECOINS.has(symbol) && r.borrowingEnabled);

    // Generate all valid pairs (skip collateral with effective LTV < 50%)
    const markets: Market[] = [];
    for (const colReserve of collateralReserves) {
      const effectiveLTV = Math.max(Number(colReserve.baseLTVasCollateral), Number(colReserve.eModeLtv));
      if (effectiveLTV < 5000) continue; // < 50% LTV — no viable looping
      const collateralAPY = yieldRates.get(colReserve.underlyingAsset.toLowerCase()) ?? null;
      for (const [, borReserve] of borrowReserves) {
        if (colReserve.underlyingAsset === borReserve.underlyingAsset) continue;
        const market = transformAaveReserve(colReserve, borReserve, collateralAPY);
        if (market.availableLiquidity < 1_000_000) continue;
        markets.push(market);
      }
    }

    return { markets };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Aave fetch failed:", message);
    return { markets: [], error: "aave_fetch_failed" };
  }
}
