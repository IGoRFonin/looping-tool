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
    cell: (info) => pct(info.getValue()),
  }),
  columnHelper.accessor("borrowAPY", {
    header: "Borrow APY",
    cell: (info) => pct(info.getValue()),
  }),
  columnHelper.accessor("availableLiquidity", {
    header: "Avail. Liquidity",
    cell: (info) => usd(info.getValue()),
  }),
  columnHelper.accessor("utilization", {
    header: "Utilization",
    cell: (info) => pct(info.getValue()),
  }),
  columnHelper.accessor("maxLTV", {
    header: "Max LTV",
    cell: (info) => pct(info.getValue()),
  }),
  columnHelper.accessor("liqThreshold", {
    header: "Liq. Threshold",
    cell: (info) => pct(info.getValue()),
  }),
  columnHelper.accessor("liqBuffer", {
    header: "Liq. Buffer",
    cell: (info) => pct(info.getValue()),
  }),
  columnHelper.accessor("leverage", {
    header: "Leverage",
    cell: (info) => `${info.getValue().toFixed(2)}x`,
  }),
  columnHelper.accessor("netAPY", {
    header: "Net APY",
    cell: (info) => {
      const v = info.getValue();
      if (v === null) return "N/A";
      const cls = v > 0 ? "text-green-600 font-semibold" : "text-red-500";
      return <span className={cls}>{pct(v)}</span>;
    },
  }),
  columnHelper.accessor("entryCost", {
    header: "Entry Cost",
    cell: (info) => pct(info.getValue()),
  }),
  columnHelper.accessor("breakEvenDays", {
    header: "Break-Even",
    cell: (info) => {
      const v = info.getValue();
      return v === null ? "N/A" : `${v.toFixed(1)} days`;
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
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b bg-gray-50">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none whitespace-nowrap"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b hover:bg-gray-50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {markets.length === 0 && (
        <p className="text-center text-gray-400 py-8">
          No markets loaded. Click Refresh to fetch data.
        </p>
      )}
    </div>
  );
}
