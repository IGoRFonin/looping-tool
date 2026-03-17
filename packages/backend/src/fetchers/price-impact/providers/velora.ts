import { getProxyFetch } from "../../../proxy.js";
import type { PriceImpactProvider, QuoteParams, PriceImpactResult } from "../types.js";

const VELORA_PRICES_URL = "https://api.paraswap.io/prices";

interface VeloraPriceRoute {
  srcAmount: string;
  destAmount: string;
  srcDecimals: number;
  destDecimals: number;
  gasCostUSD: string;
}

export class VeloraProvider implements PriceImpactProvider {
  name = "velora";

  async getQuote(params: QuoteParams): Promise<PriceImpactResult> {
    const proxyFetch = getProxyFetch();

    const url = new URL(VELORA_PRICES_URL);
    url.searchParams.set("srcToken", params.sellToken);
    url.searchParams.set("destToken", params.buyToken);
    url.searchParams.set("amount", params.sellAmountWei);
    url.searchParams.set("side", "SELL");
    url.searchParams.set("network", String(params.chainId));

    const response = await proxyFetch(url.toString());

    if (!response.ok) {
      throw new Error(`Velora API error: ${response.status} ${response.statusText}`);
    }

    const data: { priceRoute: VeloraPriceRoute } = await response.json();
    const route = data.priceRoute;

    const srcDecimal = Number(route.srcAmount) / 10 ** route.srcDecimals;
    const destDecimal = Number(route.destAmount) / 10 ** route.destDecimals;

    const effectivePrice = destDecimal > 0 ? srcDecimal / destDecimal : 0;

    const priceImpact = srcDecimal > 0
      ? Math.abs(1 - destDecimal / srcDecimal)
      : 0;

    return {
      provider: this.name,
      priceImpact,
      outputAmount: destDecimal > 0 ? destDecimal.toFixed(2) : "0",
      effectivePrice,
      gasEstimateUsd: parseFloat(route.gasCostUSD) || 0,
    };
  }
}
