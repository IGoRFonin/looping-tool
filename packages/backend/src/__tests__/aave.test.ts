import { describe, it, expect } from "vitest";
import { transformAaveReserve } from "../fetchers/aave.js";

describe("transformAaveReserve", () => {
  it("transforms Aave reserve data into Market type with correct LTV mapping", () => {
    // Aave returns LTV and liquidationThreshold in basis points (e.g., 7500 = 75%)
    // and rates in RAY (1e27)
    const reserve = {
      symbol: "USDT",
      underlyingAsset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      baseLTVasCollateral: 0n, // borrow asset doesn't matter for collateral LTV
      reserveLiquidationThreshold: 0n,
      variableBorrowRate: 31600000000000000000000000n, // ~3.16% in RAY
      liquidityRate: 10000000000000000000000000n, // ~1% in RAY
      availableLiquidity: 29891868000000n, // 6 decimals for USDT
      decimals: 6n,
      totalScaledVariableDebt: 0n,
    };

    // Collateral reserve info (what we're supplying)
    const collateralReserve = {
      symbol: "sUSDe",
      underlyingAsset: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
      baseLTVasCollateral: 9000n, // 90% in basis points
      reserveLiquidationThreshold: 9200n, // 92% in basis points
    };

    const result = transformAaveReserve(
      collateralReserve,
      reserve,
      0.035 // collateral APY from yield fetcher
    );

    expect(result.protocol).toBe("aave");
    expect(result.collateralAsset.symbol).toBe("sUSDe");
    expect(result.borrowAsset.symbol).toBe("USDT");
    expect(result.maxLTV).toBeCloseTo(0.9);
    expect(result.liqThreshold).toBeCloseTo(0.92);
    expect(result.borrowAPY).toBeCloseTo(0.0316, 3);
    expect(result.collateralAPY).toBe(0.035);
  });
});
