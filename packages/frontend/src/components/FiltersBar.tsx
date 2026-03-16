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

  const inputClasses =
    "w-full bg-input-bg border border-input-border rounded-xl px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors duration-200";

  return (
    <div className="flex flex-wrap items-end gap-4 p-5 bg-surface border border-border rounded-xl shadow-lg shadow-black/5 mb-6 transition-colors duration-300">
      <div className="min-w-[10rem]">
        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
          Target LTV %
        </label>
        <PctInput
          value={filters.targetLTV}
          placeholder="default: max LTV - 5"
          onCommit={(v) => handleCommit("targetLTV", v)}
          className={inputClasses}
        />
      </div>
      <div className="min-w-[6rem]">
        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
          Price Impact %
        </label>
        <PctInput
          value={filters.priceImpact}
          onCommit={(v) => handleCommit("priceImpact", v)}
          className={inputClasses}
        />
      </div>
      <div className="min-w-[6rem]">
        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
          Flashloan Fee %
        </label>
        <PctInput
          value={filters.flashloanFee}
          onCommit={(v) => handleCommit("flashloanFee", v)}
          className={inputClasses}
        />
      </div>
      <div className="min-w-[6rem]">
        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
          Service Fee %
        </label>
        <PctInput
          value={filters.serviceFee}
          onCommit={(v) => handleCommit("serviceFee", v)}
          className={inputClasses}
        />
      </div>
      <div className="text-sm font-mono text-text-secondary self-center pt-4">
        Total Fees:{" "}
        <span className="text-accent font-semibold">
          {(totalFees * 100).toFixed(2)}%
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {lastUpdated && (
          <span className="text-xs text-text-secondary">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all duration-200 shadow-sm"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
