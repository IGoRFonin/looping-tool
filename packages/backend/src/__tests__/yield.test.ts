import { describe, it, expect } from "vitest";
import { computeApyFromExchangeRates } from "../fetchers/yield.js";

describe("computeApyFromExchangeRates", () => {
  it("computes APY from two exchange rate snapshots", () => {
    // If exchange rate went from 1.0 to 1.001 in 24 hours
    const oldRate = 1.0;
    const newRate = 1.001;
    const elapsedSeconds = 86400; // 24 hours

    const apy = computeApyFromExchangeRates(oldRate, newRate, elapsedSeconds);

    // Daily rate = 0.1%, annualized ≈ 44% (compounding)
    // (1.001)^365 - 1 ≈ 0.4402
    expect(apy).toBeCloseTo(0.4402, 2);
  });

  it("returns 0 if exchange rate hasn't changed", () => {
    const apy = computeApyFromExchangeRates(1.0, 1.0, 86400);
    expect(apy).toBe(0);
  });

  it("handles very small rate changes", () => {
    // sUSDS-like: ~4% APY means daily change of ~0.01%
    // 1.0 → 1.0001096 in 24h ≈ 4% APY
    const apy = computeApyFromExchangeRates(1.0, 1.0001096, 86400);
    expect(apy).toBeCloseTo(0.04, 1);
  });
});
