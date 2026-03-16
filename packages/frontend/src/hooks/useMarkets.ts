import { useState, useEffect, useCallback } from "react";
import type { MarketsResponse } from "@looping-tool/shared";

const EMPTY_RESPONSE: MarketsResponse = {
  lastUpdated: "",
  markets: [],
  errors: [],
};

export function useMarkets() {
  const [data, setData] = useState<MarketsResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(false);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/markets");
      const json: MarketsResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch markets:", err);
      setData((prev) => ({
        ...prev,
        errors: [...prev.errors, "fetch_failed"],
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/markets/refresh", { method: "POST" });
      const json: MarketsResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to refresh markets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { data, loading, refresh };
}
