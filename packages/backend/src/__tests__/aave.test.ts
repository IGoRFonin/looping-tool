import { describe, it, expect } from "vitest";
import { transformAaveReserve } from "../fetchers/aave.js";

describe("transformAaveReserve", () => {
  it("transforms Aave reserve data into Market type with correct LTV mapping", () => {
    const reserve = {
      symbol: "USDT",
      underlyingAsset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      baseLTVasCollateral: 0n,
      reserveLiquidationThreshold: 0n,
      variableBorrowRate: 31600000000000000000000000n, // ~3.16% in RAY
      liquidityRate: 10000000000000000000000000n,
      availableLiquidity: 29891868000000n, // 6 decimals for USDT
      decimals: 6n,
      totalScaledVariableDebt: 0n,
      borrowingEnabled: true,
      eModeLtv: 0,
      eModeLiquidationThreshold: 0,
    };

    const collateralReserve = {
      symbol: "sUSDe",
      underlyingAsset: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
      baseLTVasCollateral: 9000n, // 90%
      reserveLiquidationThreshold: 9200n, // 92%
      eModeLtv: 0,
      eModeLiquidationThreshold: 0,
    };

    const result = transformAaveReserve(collateralReserve, reserve, 0.035);

    expect(result.protocol).toBe("aave");
    expect(result.collateralAsset.symbol).toBe("sUSDe");
    expect(result.borrowAsset.symbol).toBe("USDT");
    expect(result.maxLTV).toBeCloseTo(0.9);
    expect(result.liqThreshold).toBeCloseTo(0.92);
    expect(result.borrowAPY).toBeCloseTo(0.0316, 3);
    expect(result.collateralAPY).toBe(0.035);
  });

  it("uses eMode LTV when higher than base LTV", () => {
    const reserve = {
      symbol: "USDT",
      underlyingAsset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      baseLTVasCollateral: 0n,
      reserveLiquidationThreshold: 0n,
      variableBorrowRate: 30000000000000000000000000n,
      liquidityRate: 0n,
      availableLiquidity: 1000000000000n,
      decimals: 6n,
      totalScaledVariableDebt: 0n,
      borrowingEnabled: true,
      eModeLtv: 0,
      eModeLiquidationThreshold: 0,
    };

    // sUSDe has 0% base LTV but 90% eMode LTV
    const collateralReserve = {
      symbol: "sUSDe",
      underlyingAsset: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
      baseLTVasCollateral: 0n,
      reserveLiquidationThreshold: 7500n, // 75%
      eModeLtv: 9000, // 90%
      eModeLiquidationThreshold: 9300, // 93%
    };

    const result = transformAaveReserve(collateralReserve, reserve, 0.034);

    expect(result.maxLTV).toBeCloseTo(0.9);
    expect(result.liqThreshold).toBeCloseTo(0.93);
  });
});
