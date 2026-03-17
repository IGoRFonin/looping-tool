import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { priceImpactRouter } from "../../routes/price-impact.js";
import { cache } from "../../routes/markets.js";

vi.mock("../../fetchers/price-impact/index.js", () => ({
  PriceImpactOrchestrator: vi.fn().mockImplementation(() => ({
    getQuote: vi.fn().mockResolvedValue({
      provider: "odos",
      priceImpact: 0.001,
      outputAmount: "4985.23",
      effectivePrice: 1.02,
      gasEstimateUsd: 12.5,
    }),
  })),
}));

function createApp() {
  const app = express();
  app.use("/api", priceImpactRouter);
  return app;
}

describe("GET /api/price-impact", () => {
  beforeEach(() => {
    cache.set(
      [
        {
          protocol: "morpho" as const,
          network: "ethereum" as const,
          collateralAsset: {
            symbol: "sUSDe",
            address: "0x9d39a5de30e57443bff2a8307a4256c8797a3497",
            decimals: 18,
          },
          borrowAsset: {
            symbol: "USDT",
            address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
            decimals: 6,
          },
          collateralAPY: 0.04,
          borrowAPY: 0.03,
          maxLTV: 0.86,
          liqThreshold: 0.86,
          availableLiquidity: 5000000,
          utilization: 0.8,
          marketId: "0xabc123",
        },
      ],
      []
    );
  });

  it("returns 400 for missing params", async () => {
    const app = createApp();
    const res = await request(app).get("/api/price-impact");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing required parameter/);
  });

  it("returns 400 for invalid amountUsd", async () => {
    const app = createApp();
    const res = await request(app).get("/api/price-impact").query({
      collateral: "0x9d39a5de30e57443bff2a8307a4256c8797a3497",
      borrow: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      amountUsd: "-100",
      leverage: "3.33",
      protocol: "morpho",
      marketId: "0xabc123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amountUsd must be positive/);
  });

  it("returns 404 for unknown market", async () => {
    const app = createApp();
    const res = await request(app).get("/api/price-impact").query({
      collateral: "0x0000000000000000000000000000000000000001",
      borrow: "0x0000000000000000000000000000000000000002",
      amountUsd: "5000",
      leverage: "3.33",
      protocol: "morpho",
      marketId: "0xunknown",
    });
    expect(res.status).toBe(404);
  });

  it("returns 200 with price impact data", async () => {
    const app = createApp();
    const res = await request(app).get("/api/price-impact").query({
      collateral: "0x9d39a5de30e57443bff2a8307a4256c8797a3497",
      borrow: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      amountUsd: "5000",
      leverage: "3.33",
      protocol: "morpho",
      marketId: "0xabc123",
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("provider");
    expect(res.body).toHaveProperty("priceImpact");
    expect(res.body).toHaveProperty("outputAmount");
    expect(res.body).toHaveProperty("effectivePrice");
    expect(res.body).toHaveProperty("gasEstimateUsd");
  });
});
