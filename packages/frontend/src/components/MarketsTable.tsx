import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState, useMemo, useRef, useCallback } from "react";
import type { Market, FilterParams } from "@looping-tool/shared";
import { computeMetrics } from "../lib/calculator";

interface MarketRow extends Market {
  effectiveLTV: number;
  leverage: number;
  netAPY: number | null;
  entryCost: number;
  breakEvenDays: number | null;
  liqBuffer: number;
}

const pct = (v: number | null, decimals = 2) =>
  v === null ? "N/A" : `${(v * 100).toFixed(decimals)}%`;

const usd = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

interface Tier {
  color: string;
  label: string;
  tip: string;
}

function getBreakEvenTier(days: number | null): Tier {
  if (days === null) return { color: "var(--theme-text-secondary)", label: "N/A", tip: "Net APY <= 0, окупаемость невозможна" };
  if (days <= 3) return { color: "var(--theme-tier-excellent)", label: "< 3d", tip: "Быстрый payback, входить смело" };
  if (days <= 7) return { color: "var(--theme-tier-good)", label: "3-7d", tip: "Норм если рейты стабильны" };
  if (days <= 14) return { color: "var(--theme-tier-ok)", label: "7-14d", tip: "Рейты могут сдвинуться" };
  if (days <= 30) return { color: "var(--theme-tier-risky)", label: "14-30d", tip: "Долгий payback, рейт-риск" };
  return { color: "var(--theme-tier-bad)", label: "> 30d", tip: "Entry cost скорее всего не отобьётся" };
}

function getNetAPYTier(apy: number | null): Tier {
  if (apy === null) return { color: "var(--theme-text-secondary)", label: "N/A", tip: "Невозможно рассчитать" };
  if (apy <= 0) return { color: "var(--theme-tier-bad)", label: "Neg", tip: "Отрицательная доходность, не входить" };
  if (apy < 0.03) return { color: "var(--theme-tier-risky)", label: "< 3%", tip: "Слишком мало для лупинга" };
  if (apy < 0.05) return { color: "var(--theme-tier-ok)", label: "3-5%", tip: "Слабый spread, высокий break-even" };
  if (apy < 0.10) return { color: "var(--theme-tier-good)", label: "5-10%", tip: "Нормальная доходность" };
  return { color: "var(--theme-tier-excellent)", label: "> 10%", tip: "Отличный spread, цель профи" };
}

function getEntryCostTier(cost: number): Tier {
  if (cost <= 0.0005) return { color: "var(--theme-tier-excellent)", label: "< 0.05%", tip: "Минимальный входной friction" };
  if (cost <= 0.001) return { color: "var(--theme-tier-good)", label: "0.05-0.1%", tip: "Приемлемо для крупных позиций" };
  if (cost <= 0.003) return { color: "var(--theme-tier-ok)", label: "0.1-0.3%", tip: "Следи за break-even" };
  if (cost <= 0.005) return { color: "var(--theme-tier-risky)", label: "0.3-0.5%", tip: "Только если spread > 5%" };
  return { color: "var(--theme-tier-bad)", label: "> 0.5%", tip: "Slippage съест доход" };
}

function TierCell({ value, tier }: { value: string; tier: Tier }) {
  const tipRef = useRef<HTMLSpanElement>(null);

  const onEnter = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    const el = tipRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    el.style.top = `${rect.top - 8}px`;
    el.style.transform = "translateY(-100%)";
    el.style.left = "";
    el.style.right = "";
    // measure tooltip width
    el.style.visibility = "hidden";
    el.style.display = "block";
    const tipW = el.offsetWidth;
    el.style.display = "";
    el.style.visibility = "";
    // clamp to viewport
    const margin = 8;
    if (cx - tipW / 2 < margin) {
      el.style.left = `${margin}px`;
    } else if (cx + tipW / 2 > window.innerWidth - margin) {
      el.style.right = `${margin}px`;
    } else {
      el.style.left = `${cx}px`;
      el.style.transform = "translate(-50%, -100%)";
    }
  }, []);

  return (
    <span className="tier-cell font-mono" style={{ color: tier.color }} onMouseEnter={onEnter}>
      {value}
      <span ref={tipRef} className="tier-tooltip">
        <span style={{ color: tier.color, fontWeight: 600 }}>{tier.label}</span>
        {" : "}
        {tier.tip}
      </span>
    </span>
  );
}

const columnHelper = createColumnHelper<MarketRow>();

const columns = [
  columnHelper.accessor("network", { header: "Network", cell: () => "Ethereum" }),
  columnHelper.accessor("protocol", {
    header: "Protocol",
    cell: (info) => info.getValue() === "morpho" ? "Morpho" : "Aave",
  }),
  columnHelper.accessor("collateralAsset", {
    header: "Collateral",
    cell: (info) => info.getValue().symbol,
    sortingFn: (a, b) =>
      a.original.collateralAsset.symbol.localeCompare(b.original.collateralAsset.symbol),
  }),
  columnHelper.accessor("borrowAsset", {
    header: "Borrow",
    cell: (info) => info.getValue().symbol,
    sortingFn: (a, b) =>
      a.original.borrowAsset.symbol.localeCompare(b.original.borrowAsset.symbol),
  }),
  columnHelper.accessor("collateralAPY", {
    header: "Collateral APY",
    cell: (info) => <span className="font-mono">{pct(info.getValue())}</span>,
  }),
  columnHelper.accessor("borrowAPY", {
    header: "Borrow APY",
    cell: (info) => <span className="font-mono">{pct(info.getValue())}</span>,
  }),
  columnHelper.accessor("availableLiquidity", {
    header: "Avail. Liquidity",
    cell: (info) => <span className="font-mono">{usd(info.getValue())}</span>,
  }),
  columnHelper.accessor("utilization", {
    header: "Utilization",
    cell: (info) => <span className="font-mono">{pct(info.getValue())}</span>,
  }),
  columnHelper.accessor("maxLTV", {
    header: "Max LTV",
    cell: (info) => <span className="font-mono">{pct(info.getValue())}</span>,
  }),
  columnHelper.accessor("liqThreshold", {
    header: "Liq. Threshold",
    cell: (info) => <span className="font-mono">{pct(info.getValue())}</span>,
  }),
  columnHelper.accessor("liqBuffer", {
    header: "Liq. Buffer",
    cell: (info) => <span className="font-mono">{pct(info.getValue())}</span>,
  }),
  columnHelper.accessor("leverage", {
    header: "Leverage",
    cell: (info) => <span className="font-mono">{info.getValue().toFixed(2)}x</span>,
  }),
  columnHelper.accessor("netAPY", {
    header: "Net APY",
    cell: (info) => {
      const v = info.getValue();
      const tier = getNetAPYTier(v);
      return <TierCell value={v === null ? "N/A" : pct(v)} tier={tier} />;
    },
  }),
  columnHelper.accessor("entryCost", {
    header: "Entry Cost",
    cell: (info) => {
      const v = info.getValue();
      const tier = getEntryCostTier(v);
      return <TierCell value={pct(v)} tier={tier} />;
    },
  }),
  columnHelper.accessor("breakEvenDays", {
    header: "Break-Even",
    cell: (info) => {
      const v = info.getValue();
      const tier = getBreakEvenTier(v);
      const display = v === null ? "N/A" : `${v.toFixed(1)} days`;
      return <TierCell value={display} tier={tier} />;
    },
  }),
];

interface MarketsTableProps {
  markets: Market[];
  filters: FilterParams;
}

export function MarketsTable({ markets, filters }: MarketsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "netAPY", desc: true },
  ]);

  const rows: MarketRow[] = useMemo(
    () =>
      markets.map((m) => ({
        ...m,
        ...computeMetrics(m, filters),
      })),
    [markets, filters]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-surface border border-border rounded-xl shadow-lg shadow-black/5 overflow-hidden transition-colors duration-300">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-table-header border-b border-border">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="px-3 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-text-primary transition-colors duration-200"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: " \u2191", desc: " \u2193" }[h.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-border/50 hover:bg-row-hover transition-colors duration-150 ${
                  i % 2 === 1 ? "bg-row-alt" : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-2 whitespace-nowrap text-text-primary"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {markets.length === 0 && (
        <p className="text-center text-text-secondary py-12">
          No markets loaded. Click Refresh to fetch data.
        </p>
      )}
    </div>
  );
}
