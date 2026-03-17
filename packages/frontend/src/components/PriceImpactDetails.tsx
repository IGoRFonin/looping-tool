import type { Market, FilterParams, PriceImpactResponse, ComputedMetrics } from "@looping-tool/shared";
import { computeMetricsWithRealImpact } from "../lib/calculator";

interface Props {
  market: Market;
  filters: FilterParams;
  data: PriceImpactResponse;
  defaultMetrics: ComputedMetrics;
}

function pct(value: number, decimals = 2): string {
  return (value * 100).toFixed(decimals) + "%";
}

function days(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(1) + " дн.";
}

export function PriceImpactDetails({ market, filters, data, defaultMetrics }: Props) {
  const realMetrics = computeMetricsWithRealImpact(market, filters, data.priceImpact);

  return (
    <div className="px-4 py-3 bg-surface border-t border-border text-sm grid grid-cols-2 gap-x-8 gap-y-2 max-w-2xl">
      <div>
        <span className="text-text-secondary">Price Impact:</span>{" "}
        <span className="font-medium">{pct(data.priceImpact)}</span>
      </div>
      <div>
        <span className="text-text-secondary">Провайдер:</span>{" "}
        <span className="font-medium capitalize">{data.provider}</span>
      </div>

      <div>
        <span className="text-text-secondary">Эфф. цена:</span>{" "}
        <span className="font-medium">
          1 {market.collateralAsset.symbol} = {data.effectivePrice.toFixed(4)}{" "}
          {market.borrowAsset.symbol}
        </span>
      </div>
      <div>
        <span className="text-text-secondary">Получите:</span>{" "}
        <span className="font-medium">
          {data.outputAmount} {market.collateralAsset.symbol}
        </span>
      </div>

      <div>
        <span className="text-text-secondary">Gas:</span>{" "}
        <span className="font-medium">~${data.gasEstimateUsd.toFixed(2)}</span>
      </div>
      <div />

      <div className="col-span-2 border-t border-border my-1" />

      <div>
        <span className="text-text-secondary">Entry Cost (реальный):</span>{" "}
        <span className="font-medium">{pct(realMetrics.entryCost)}</span>
        <span className="text-text-secondary ml-2">vs {pct(defaultMetrics.entryCost)}</span>
      </div>
      <div>
        <span className="text-text-secondary">Break-Even (реальный):</span>{" "}
        <span className="font-medium">{days(realMetrics.breakEvenDays)}</span>
        <span className="text-text-secondary ml-2">vs {days(defaultMetrics.breakEvenDays)}</span>
      </div>
    </div>
  );
}
