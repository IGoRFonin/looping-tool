import type { QuoteParams, PriceImpactResult, PriceImpactProvider } from "./types.js";
import { OdosProvider } from "./providers/odos.js";
import { VeloraProvider } from "./providers/velora.js";

const THROTTLE_MS = 1000;

export class PriceImpactOrchestrator {
  private lastRequestTime = 0;

  constructor(
    private primary: PriceImpactProvider = new OdosProvider(),
    private fallback: PriceImpactProvider = new VeloraProvider()
  ) {}

  async getQuote(params: QuoteParams): Promise<PriceImpactResult> {
    await this.throttle();

    const start = Date.now();
    let primaryError: Error | undefined;

    try {
      const result = await this.primary.getQuote(params);
      const elapsed = Date.now() - start;
      console.log(
        `[INFO] price-impact: ${result.provider} | ${params.buyToken}/${params.sellToken} | ${params.sellAmountWei} wei | ${(result.priceImpact * 100).toFixed(2)}% | ${elapsed}ms`
      );
      return result;
    } catch (err) {
      primaryError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[WARN] price-impact: ${this.primary.name} failed (${primaryError.message}), falling back to ${this.fallback.name}`
      );
    }

    try {
      const result = await this.fallback.getQuote(params);
      const elapsed = Date.now() - start;
      console.log(
        `[INFO] price-impact: ${result.provider} | ${params.buyToken}/${params.sellToken} | ${params.sellAmountWei} wei | ${(result.priceImpact * 100).toFixed(2)}% | ${elapsed}ms (fallback)`
      );
      return result;
    } catch (fallbackErr) {
      const fallbackError = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
      console.error(
        `[ERROR] price-impact: all providers failed | ${this.primary.name}: ${primaryError?.message} | ${this.fallback.name}: ${fallbackError.message}`
      );
      throw new Error("All price impact providers failed");
    }
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < THROTTLE_MS) {
      await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
