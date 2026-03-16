import { useState } from "react";
import type { FilterParams } from "@looping-tool/shared";
import { useMarkets } from "./hooks/useMarkets";
import { FiltersBar } from "./components/FiltersBar";
import { MarketsTable } from "./components/MarketsTable";
import { useTheme } from "./context/ThemeContext";

const DEFAULT_FILTERS: FilterParams = {
  targetLTV: null,
  priceImpact: 0.0007,
  flashloanFee: 0.0009,
  serviceFee: 0.0001,
};

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center w-16 h-8 rounded-full bg-surface border border-border transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-accent"
      aria-label="Toggle theme"
    >
      <span
        className={`absolute top-1 left-1 flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white transition-transform duration-300 ${
          theme === "light" ? "translate-x-8" : "translate-x-0"
        }`}
      >
        {theme === "dark" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </span>
    </button>
  );
}

function App() {
  const { data, loading, refresh } = useMarkets();
  const [filters, setFilters] = useState<FilterParams>(DEFAULT_FILTERS);

  const isFresh =
    data.lastUpdated &&
    Date.now() - new Date(data.lastUpdated).getTime() < 5 * 60 * 1000;

  return (
    <div className="min-h-screen bg-bg transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              DeFi Looping Strategy Scanner
            </h1>
            {isFresh && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-positive opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-positive" />
              </span>
            )}
          </div>
          <ThemeToggle />
        </header>

        {data.errors.length > 0 && (
          <div className="bg-warning-bg border border-warning-border rounded-xl p-4 mb-6 text-sm text-warning-text">
            Data issues: {data.errors.join(", ")}
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
    </div>
  );
}

export default App;
