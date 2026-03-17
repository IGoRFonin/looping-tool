import { describe, it, expect, vi, beforeEach } from "vitest";
import { PriceImpactOrchestrator } from "../../fetchers/price-impact/index.js";
import type { PriceImpactProvider, PriceImpactResult } from "../../fetchers/price-impact/types.js";

function createMockProvider(
  name: string,
  result?: PriceImpactResult,
  error?: Error
): PriceImpactProvider {
  return {
    name,
    getQuote: error
      ? vi.fn().mockRejectedValue(error)
      : vi.fn().mockResolvedValue(result),
  };
}

const MOCK_RESULT: PriceImpactResult = {
  provider: "test",
  priceImpact: 0.001,
  outputAmount: "4985.23",
  effectivePrice: 1.02,
  gasEstimateUsd: 12.5,
};

const PARAMS = {
  sellToken: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  buyToken: "0x9d39a5de30e57443bff2a8307a4256c8797a3497",
  sellAmountWei: "16650000000",
  chainId: 1,
};

describe("PriceImpactOrchestrator", () => {
  it("returns result from primary provider", async () => {
    const primary = createMockProvider("odos", { ...MOCK_RESULT, provider: "odos" });
    const fallback = createMockProvider("velora", { ...MOCK_RESULT, provider: "velora" });
    const orchestrator = new PriceImpactOrchestrator(primary, fallback);

    const result = await orchestrator.getQuote(PARAMS);

    expect(result.provider).toBe("odos");
    expect(primary.getQuote).toHaveBeenCalledOnce();
    expect(fallback.getQuote).not.toHaveBeenCalled();
  });

  it("falls back to secondary when primary fails", async () => {
    const primary = createMockProvider("odos", undefined, new Error("429"));
    const fallback = createMockProvider("velora", { ...MOCK_RESULT, provider: "velora" });
    const orchestrator = new PriceImpactOrchestrator(primary, fallback);

    const result = await orchestrator.getQuote(PARAMS);

    expect(result.provider).toBe("velora");
    expect(primary.getQuote).toHaveBeenCalledOnce();
    expect(fallback.getQuote).toHaveBeenCalledOnce();
  });

  it("throws when both providers fail", async () => {
    const primary = createMockProvider("odos", undefined, new Error("429"));
    const fallback = createMockProvider("velora", undefined, new Error("timeout"));
    const orchestrator = new PriceImpactOrchestrator(primary, fallback);

    await expect(orchestrator.getQuote(PARAMS)).rejects.toThrow(
      "All price impact providers failed"
    );
  });

  it("throttles requests to 1 RPS", async () => {
    const primary = createMockProvider("odos", { ...MOCK_RESULT, provider: "odos" });
    const fallback = createMockProvider("velora", { ...MOCK_RESULT, provider: "velora" });
    const orchestrator = new PriceImpactOrchestrator(primary, fallback);

    const start = Date.now();
    await orchestrator.getQuote(PARAMS);
    await orchestrator.getQuote(PARAMS);
    const elapsed = Date.now() - start;

    // Second call should have waited ~1000ms
    expect(elapsed).toBeGreaterThanOrEqual(900);
  });
});
