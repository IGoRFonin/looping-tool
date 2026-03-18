import { describe, it, expect } from "vitest";
import { computeMetrics } from "../calculator";
import type { Market, FilterParams } from "@looping-tool/shared";

const baseMarket: Market = {
  protocol: "morpho",
  network: "ethereum",
  collateralAsset: { symbol: "sUSDS", address: "0xaaa", decimals: 18 },
  borrowAsset: { symbol: "USDT", address: "0xbbb", decimals: 6 },
  collateralAPY: 0.04,
  borrowAPY: 0.0316,
  maxLTV: 0.965,
  liqThreshold: 0.965,
  availableLiquidity: 29891868,
  utilization: 0.8947,
};

const defaultFilters: FilterParams = {
  targetLTV: null,
  priceImpact: 0.0007,
  flashloanFee: 0.0009,
  serviceFee: 0.0001,
};

describe("computeMetrics", () => {
  it("computes metrics with default target LTV (maxLTV - 0.05)", () => {
    const m = computeMetrics(baseMarket, defaultFilters);

    // effectiveLTV = 0.965 - 0.05 = 0.915
    expect(m.effectiveLTV).toBeCloseTo(0.915, 3);
    // leverage = 1 / (1 - 0.915) ≈ 11.76
    expect(m.leverage).toBeCloseTo(11.76, 1);
    // netAPY = 0.04 * 11.76 - 0.0316 * 10.76 ≈ 0.4704 - 0.3400 ≈ 0.1304
    expect(m.netAPY).toBeCloseTo(0.1304, 2);
    // liqBuffer = 1 - 0.915 / 0.965 ≈ 0.05181
    expect(m.liqBuffer).toBeCloseTo(0.05181, 3);
    // entryCost = 0.0007 + 0.0009 + 0.0001 = 0.0017
    expect(m.entryCost).toBeCloseTo(0.0017, 4);
    // breakEvenDays = (0.0017 / 0.1304) * 365 ≈ 4.76
    expect(m.breakEvenDays).toBeCloseTo(4.76, 0);
  });

  it("uses user-provided target LTV when set", () => {
    const filters = { ...defaultFilters, targetLTV: 0.90 };
    const m = computeMetrics(baseMarket, filters);

    expect(m.effectiveLTV).toBeCloseTo(0.90, 3);
    expect(m.leverage).toBeCloseTo(10, 1);
  });

  it("clamps target LTV to maxLTV", () => {
    const filters = { ...defaultFilters, targetLTV: 0.99 };
    const m = computeMetrics(baseMarket, filters);

    // Should clamp to maxLTV (0.965), not use 0.99
    expect(m.effectiveLTV).toBeCloseTo(0.965, 3);
  });

  it("returns null netAPY and breakEvenDays when collateralAPY is null", () => {
    const market = { ...baseMarket, collateralAPY: null };
    const m = computeMetrics(market, defaultFilters);

    expect(m.netAPY).toBeNull();
    expect(m.breakEvenDays).toBeNull();
  });

  it("returns null breakEvenDays when netAPY <= 0", () => {
    // borrowAPY higher than collateralAPY → negative netAPY
    const market = { ...baseMarket, collateralAPY: 0.01, borrowAPY: 0.05 };
    const m = computeMetrics(market, defaultFilters);

    expect(m.netAPY).toBeLessThan(0);
    expect(m.breakEvenDays).toBeNull();
  });
});
