import { type FilterParams } from "@looping-tool/shared";

interface FiltersBarProps {
  filters: FilterParams;
  onChange: (filters: FilterParams) => void;
  onRefresh: () => void;
  lastUpdated: string;
  loading: boolean;
}

export function FiltersBar({
  filters,
  onChange,
  onRefresh,
  lastUpdated,
  loading,
}: FiltersBarProps) {
  const totalFees = filters.priceImpact + filters.flashloanFee + filters.serviceFee;

  const handleChange = (key: keyof FilterParams, displayValue: string) => {
    const num = parseFloat(displayValue);
    if (key === "targetLTV") {
      onChange({ ...filters, targetLTV: displayValue === "" ? null : num / 100 });
    } else {
      onChange({ ...filters, [key]: isNaN(num) ? 0 : num / 100 });
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-lg mb-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">TARGET LTV %</label>
        <input
          type="text"
          placeholder="default: max LTV - 5"
          value={filters.targetLTV !== null ? (filters.targetLTV * 100).toFixed(1) : ""}
          onChange={(e) => handleChange("targetLTV", e.target.value)}
          className="border rounded px-2 py-1 w-44 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">PRICE IMPACT %</label>
        <input
          type="text"
          value={(filters.priceImpact * 100).toFixed(2)}
          onChange={(e) => handleChange("priceImpact", e.target.value)}
          className="border rounded px-2 py-1 w-24 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">FLASHLOAN FEE %</label>
        <input
          type="text"
          value={(filters.flashloanFee * 100).toFixed(2)}
          onChange={(e) => handleChange("flashloanFee", e.target.value)}
          className="border rounded px-2 py-1 w-24 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">SERVICE FEE %</label>
        <input
          type="text"
          value={(filters.serviceFee * 100).toFixed(2)}
          onChange={(e) => handleChange("serviceFee", e.target.value)}
          className="border rounded px-2 py-1 w-24 text-sm"
        />
      </div>
      <div className="text-sm text-gray-600">
        Total Fees: {(totalFees * 100).toFixed(2)}%
      </div>
      <div className="ml-auto flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1 bg-white border rounded text-sm hover:bg-gray-100 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
