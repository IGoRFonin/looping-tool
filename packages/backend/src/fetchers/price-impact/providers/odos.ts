import { getProxyFetch } from "../../../proxy.js";
import type { PriceImpactProvider, QuoteParams, PriceImpactResult } from "../types.js";

const ODOS_QUOTE_URL = "https://api.odos.xyz/sor/quote/v3";

interface OdosQuoteResponse {
  priceImpact: number | null;
  outAmounts: string[];
  outValues: number[];
  inValues: number[];
  gasEstimate: number;
  gasEstimateValue: number;
}

export class OdosProvider implements PriceImpactProvider {
  name = "odos";

  async getQuote(params: QuoteParams): Promise<PriceImpactResult> {
    const proxyFetch = getProxyFetch();

    const body = {
      chainId: params.chainId,
      inputTokens: [
        { tokenAddress: params.sellToken, amount: params.sellAmountWei },
      ],
      outputTokens: [
        { tokenAddress: params.buyToken, proportion: 1 },
      ],
    };

    const response = await proxyFetch(ODOS_QUOTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Odos API error: ${response.status} ${response.statusText}`);
    }

    const data: OdosQuoteResponse = await response.json();

    const inValue = data.inValues[0] ?? 0;
    const outValue = data.outValues[0] ?? 0;
    const effectivePrice = outValue > 0 ? inValue / outValue : 0;

    return {
      provider: this.name,
      priceImpact: Math.abs(data.priceImpact ?? 0),
      outputAmount: outValue > 0 ? outValue.toFixed(2) : "0",
      effectivePrice,
      gasEstimateUsd: data.gasEstimateValue,
    };
  }
}
