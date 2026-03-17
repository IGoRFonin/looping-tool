import { describe, it, expect, vi } from "vitest";
import { transformMorphoMarket } from "../fetchers/morpho.js";

describe("transformMorphoMarket", () => {
  it("transforms a Morpho API market into our Market type", () => {
    const apiMarket = {
      uniqueKey: "0x3274643db77a064abd3bc851de77556a4ad2e2f502f4f0c80845fa8f909ecf0b",
      lltv: "965000000000000000", // 0.965 in 18-decimal WAD
      collateralAsset: { symbol: "sUSDS", address: "0xaaa", decimals: 18 },
      loanAsset: { symbol: "USDT", address: "0xbbb", decimals: 6 },
      state: {
        borrowApy: 0.0316,
        supplyApy: 0.01,
        liquidityAssetsUsd: 29891868,
        utilization: 0.8947,
      },
    };

    const result = transformMorphoMarket(apiMarket, 0.04);

    expect(result.protocol).toBe("morpho");
    expect(result.network).toBe("ethereum");
    expect(result.collateralAsset.symbol).toBe("sUSDS");
    expect(result.borrowAsset.symbol).toBe("USDT");
    expect(result.collateralAPY).toBe(0.04);
    expect(result.borrowAPY).toBe(0.0316);
    expect(result.maxLTV).toBeCloseTo(0.965);
    expect(result.liqThreshold).toBeCloseTo(0.965);
    expect(result.availableLiquidity).toBe(29891868);
    expect(result.utilization).toBe(0.8947);
    expect(result.marketId).toBe("0x3274643db77a064abd3bc851de77556a4ad2e2f502f4f0c80845fa8f909ecf0b");
  });

  it("sets collateralAPY to null when yield rate unavailable", () => {
    const apiMarket = {
      uniqueKey: "0xabc",
      lltv: "900000000000000000",
      collateralAsset: { symbol: "sUSDe", address: "0xccc", decimals: 18 },
      loanAsset: { symbol: "USDC", address: "0xddd", decimals: 6 },
      state: {
        borrowApy: 0.02,
        supplyApy: 0.005,
        liquidityAssetsUsd: 1000000,
        utilization: 0.5,
      },
    };

    const result = transformMorphoMarket(apiMarket, null);
    expect(result.collateralAPY).toBeNull();
  });
});
