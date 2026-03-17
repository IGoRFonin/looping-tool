import { describe, it, expect, vi, beforeEach } from "vitest";
import { VeloraProvider } from "../../fetchers/price-impact/providers/velora.js";

vi.mock("../../proxy.js", () => ({
  getProxyFetch: () => mockFetch,
}));

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
});

describe("VeloraProvider", () => {
  const provider = new VeloraProvider();
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
        priceRoute: {
          srcAmount: "16650000000",
          destAmount: "16130000000000000000000",
          srcDecimals: 6,
          destDecimals: 18,
          gasCostUSD: "12.50",
        },
      }),
    });

    const result = await provider.getQuote(params);

    expect(result.provider).toBe("velora");
    expect(typeof result.priceImpact).toBe("number");
    expect(result.priceImpact).toBeGreaterThanOrEqual(0);
    expect(typeof result.outputAmount).toBe("string");
    expect(typeof result.effectivePrice).toBe("number");
    expect(result.gasEstimateUsd).toBe(12.5);
  });

  it("builds correct URL with query params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        priceRoute: {
          srcAmount: "16650000000",
          destAmount: "16130000000000000000000",
          srcDecimals: 6,
          destDecimals: 18,
          gasCostUSD: "0",
        },
      }),
    });

    await provider.getQuote(params);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("https://api.paraswap.io/prices");
    expect(calledUrl).toContain(`srcToken=${params.sellToken}`);
    expect(calledUrl).toContain(`destToken=${params.buyToken}`);
    expect(calledUrl).toContain(`amount=${params.sellAmountWei}`);
    expect(calledUrl).toContain("network=1");
    expect(calledUrl).toContain("side=SELL");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(provider.getQuote(params)).rejects.toThrow("500");
  });
});
