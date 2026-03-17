import { describe, it, expect, vi, beforeEach } from "vitest";
import { OdosProvider } from "../../fetchers/price-impact/providers/odos.js";

vi.mock("../../proxy.js", () => ({
  getProxyFetch: () => mockFetch,
}));

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
});

describe("OdosProvider", () => {
  const provider = new OdosProvider();
  const params = {
    sellToken: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    buyToken: "0x9d39a5de30e57443bff2a8307a4256c8797a3497",
    sellAmountWei: "16650000000",
    chainId: 1,
  };

  it("returns price impact result on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        priceImpact: -0.0012,
        outAmounts: ["16130000000000000000000"],
        outValues: [16130.5],
        inValues: [16650],
        gasEstimate: 250000,
        gasEstimateValue: 12.5,
      }),
    });

    const result = await provider.getQuote(params);

    expect(result.provider).toBe("odos");
    expect(result.priceImpact).toBeCloseTo(0.0012);
    expect(result.gasEstimateUsd).toBe(12.5);
    expect(typeof result.outputAmount).toBe("string");
    expect(typeof result.effectivePrice).toBe("number");
  });

  it("sends correct request body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        priceImpact: 0,
        outAmounts: ["1000"],
        outValues: [1],
        inValues: [1],
        gasEstimate: 100000,
        gasEstimateValue: 5,
      }),
    });

    await provider.getQuote(params);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.odos.xyz/sor/quote/v3",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chainId).toBe(1);
    expect(body.inputTokens).toEqual([
      { tokenAddress: params.sellToken, amount: params.sellAmountWei },
    ]);
    expect(body.outputTokens).toEqual([
      { tokenAddress: params.buyToken, proportion: 1 },
    ]);
    expect(body.likeAsset).toBeUndefined();
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });

    await expect(provider.getQuote(params)).rejects.toThrow("429");
  });
});
