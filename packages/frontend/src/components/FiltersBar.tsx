import { useState, useEffect } from "react";
import { type FilterParams } from "@looping-tool/shared";

interface FiltersBarProps {
  filters: FilterParams;
  onChange: (filters: FilterParams) => void;
  onRefresh: () => void;
  lastUpdated: string;
  loading: boolean;
}

/** A number input that lets you type freely and only commits on blur. */
function PctInput({
  value,
  placeholder,
  className,
  onCommit,
}: {
  value: number | null;
  placeholder?: string;
  className?: string;
  onCommit: (v: string) => void;
}) {
  const display = value !== null ? String(value * 100) : "";
  const [text, setText] = useState(display);
  const [focused, setFocused] = useState(false);

  // Sync from parent when not focused
  useEffect(() => {
    if (!focused) setText(display);
  }, [display, focused]);

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={focused ? text : display}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onCommit(text);
      }}
      className={className}
    />
  );
}

export function FiltersBar({
  filters,
  onChange,
  onRefresh,
  lastUpdated,
  loading,
}: FiltersBarProps) {
  const totalFees = filters.priceImpact + filters.flashloanFee + filters.serviceFee;

  const handleCommit = (key: keyof FilterParams, displayValue: string) => {
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
        <PctInput
          value={filters.targetLTV}
          placeholder="default: max LTV - 5"
          onCommit={(v) => handleCommit("targetLTV", v)}
          className="border rounded px-2 py-1 w-44 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">PRICE IMPACT %</label>
        <PctInput
          value={filters.priceImpact}
          onCommit={(v) => handleCommit("priceImpact", v)}
          className="border rounded px-2 py-1 w-24 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">FLASHLOAN FEE %</label>
        <PctInput
          value={filters.flashloanFee}
          onCommit={(v) => handleCommit("flashloanFee", v)}
          className="border rounded px-2 py-1 w-24 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">SERVICE FEE %</label>
        <PctInput
          value={filters.serviceFee}
          onCommit={(v) => handleCommit("serviceFee", v)}
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
