import { useState, useCallback } from "react";
import type { PriceImpactResponse } from "@looping-tool/shared";
import type { Market } from "@looping-tool/shared";

interface PriceImpactState {
  data: PriceImpactResponse | null;
  loading: boolean;
  error: string | null;
}

export function usePriceImpact() {
  const [states, setStates] = useState<Record<string, PriceImpactState>>({});

  const getKey = useCallback((market: Market) => {
    if (market.protocol === "morpho" && market.marketId) {
      return `${market.protocol}:${market.marketId}`;
    }
    return `${market.protocol}:${market.collateralAsset.address}:${market.borrowAsset.address}`;
  }, []);

  const fetchPriceImpact = useCallback(
    async (market: Market, amountUsd: number, leverage: number) => {
      const key = getKey(market);

      setStates((prev) => ({
        ...prev,
        [key]: { data: null, loading: true, error: null },
      }));

      try {
        const params = new URLSearchParams({
          collateral: market.collateralAsset.address,
          borrow: market.borrowAsset.address,
          amountUsd: String(amountUsd),
          leverage: String(leverage),
          protocol: market.protocol,
          ...(market.marketId ? { marketId: market.marketId } : {}),
        });

        const response = await fetch(`/api/price-impact?${params}`);

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(body.error || `HTTP ${response.status}`);
        }

        const data: PriceImpactResponse = await response.json();

        setStates((prev) => ({
          ...prev,
          [key]: { data, loading: false, error: null },
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStates((prev) => ({
          ...prev,
          [key]: { data: null, loading: false, error: message },
        }));
      }
    },
    [getKey]
  );

  const resetAll = useCallback(() => {
    setStates({});
  }, []);

  const getState = useCallback(
    (market: Market): PriceImpactState => {
      const key = getKey(market);
      return states[key] ?? { data: null, loading: false, error: null };
    },
    [states, getKey]
  );

  return { fetchPriceImpact, resetAll, getState };
}
