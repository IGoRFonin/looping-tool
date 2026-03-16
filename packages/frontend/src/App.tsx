import { useState } from "react";
import type { FilterParams } from "@looping-tool/shared";
import { useMarkets } from "./hooks/useMarkets";
import { FiltersBar } from "./components/FiltersBar";
import { MarketsTable } from "./components/MarketsTable";

const DEFAULT_FILTERS: FilterParams = {
  targetLTV: null,
  priceImpact: 0.0007,
  flashloanFee: 0.0009,
  serviceFee: 0.0001,
};

function App() {
  const { data, loading, refresh } = useMarkets();
  const [filters, setFilters] = useState<FilterParams>(DEFAULT_FILTERS);

  return (
    <div className="max-w-[1600px] mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">DeFi Looping Strategy Scanner</h1>

      {data.errors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-800">
          ⚠ Data issues: {data.errors.join(", ")}
        </div>
      )}

      <FiltersBar
        filters={filters}
        onChange={setFilters}
        onRefresh={refresh}
        lastUpdated={data.lastUpdated}
        loading={loading}
      />

      <MarketsTable markets={data.markets} filters={filters} />
    </div>
  );
}

export default App;
