import type { Market, MarketsResponse } from "@looping-tool/shared";

export class MarketCache {
  private markets: Market[] = [];
  private errors: string[] = [];
  private lastUpdated = "";

  set(markets: Market[], errors: string[]): void {
    this.markets = markets;
    this.errors = errors;
    this.lastUpdated = new Date().toISOString();
  }

  get(): MarketsResponse {
    return {
      lastUpdated: this.lastUpdated,
      markets: this.markets,
      errors: this.errors,
    };
  }
}
