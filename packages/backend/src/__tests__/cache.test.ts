import { describe, it, expect, beforeEach } from "vitest";
import { MarketCache } from "../cache.js";
import type { Market } from "@looping-tool/shared";

const mockMarket: Market = {
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
  marketId: "0x3274",
};

describe("MarketCache", () => {
  let cache: MarketCache;

  beforeEach(() => {
    cache = new MarketCache();
  });

  it("returns empty data before any update", () => {
    const data = cache.get();
    expect(data.markets).toEqual([]);
    expect(data.errors).toEqual([]);
    expect(data.lastUpdated).toBe("");
  });

  it("stores and retrieves markets", () => {
    cache.set([mockMarket], []);
    const data = cache.get();
    expect(data.markets).toHaveLength(1);
    expect(data.markets[0].collateralAsset.symbol).toBe("sUSDS");
    expect(data.lastUpdated).not.toBe("");
  });

  it("stores errors alongside markets", () => {
    cache.set([mockMarket], ["morpho_fetch_failed"]);
    const data = cache.get();
    expect(data.markets).toHaveLength(1);
    expect(data.errors).toEqual(["morpho_fetch_failed"]);
  });
});
