export interface QuoteParams {
  sellToken: string;
  buyToken: string;
  sellAmountWei: string;
  chainId: number;
}

export interface PriceImpactResult {
  provider: string;
  priceImpact: number;
  outputAmount: string;
  effectivePrice: number;
  gasEstimateUsd: number;
}

export interface PriceImpactProvider {
  name: string;
  getQuote(params: QuoteParams): Promise<PriceImpactResult>;
}
