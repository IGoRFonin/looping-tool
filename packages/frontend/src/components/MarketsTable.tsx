import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";
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
      if (v === null) return <span className="font-mono">N/A</span>;
      const cls = v > 0 ? "text-positive font-semibold" : "text-negative";
      return <span className={`font-mono ${cls}`}>{pct(v)}</span>;
    },
  }),
  columnHelper.accessor("entryCost", {
    header: "Entry Cost",
    cell: (info) => <span className="font-mono">{pct(info.getValue())}</span>,
  }),
  columnHelper.accessor("breakEvenDays", {
    header: "Break-Even",
    cell: (info) => {
      const v = info.getValue();
      return <span className="font-mono">{v === null ? "N/A" : `${v.toFixed(1)} days`}</span>;
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
