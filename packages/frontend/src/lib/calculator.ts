import type { Market, FilterParams, ComputedMetrics } from "@looping-tool/shared";

/**
 * Compute derived looping strategy metrics for a market.
 * All inputs/outputs use decimal convention (0.0 to 1.0).
 */
export function computeMetrics(
  market: Market,
  filters: FilterParams
): ComputedMetrics {
  const effectiveLTV =
    filters.targetLTV !== null
      ? Math.min(filters.targetLTV, market.maxLTV)
      : market.maxLTV - 0.05;

  const leverage = 1 / (1 - effectiveLTV);
  const entryCost = filters.priceImpact + filters.flashloanFee + filters.serviceFee;
  const liqBuffer = 1 - effectiveLTV / market.liqThreshold;

  if (market.collateralAPY === null) {
    return { effectiveLTV, leverage, netAPY: null, entryCost, breakEvenDays: null, liqBuffer };
  }

  const netAPY = market.collateralAPY * leverage - market.borrowAPY * (leverage - 1);
  const breakEvenDays = netAPY > 0 ? (entryCost / netAPY) * 365 : null;

  return { effectiveLTV, leverage, netAPY, entryCost, breakEvenDays, liqBuffer };
}

/** Recompute metrics using a real price impact value instead of the filter default */
export function computeMetricsWithRealImpact(
  market: Market,
  filters: FilterParams,
  realPriceImpact: number
): ComputedMetrics {
  return computeMetrics(market, {
    ...filters,
    priceImpact: realPriceImpact,
  });
}
