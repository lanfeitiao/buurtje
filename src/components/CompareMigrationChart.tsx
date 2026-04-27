"use client";

import type { CompareDataColumn } from "@/lib/types";

interface CompareMigrationChartProps {
  columns: CompareDataColumn[];
}

export default function CompareMigrationChart({
  columns,
}: CompareMigrationChartProps) {
  const usableColumns = columns.filter(
    (c) => c.data?.migration?.breakdown?.length
  );
  if (usableColumns.length === 0) return null;

  // Canonical origin order; anything else from the scraper lands after
  // these in first-seen order.
  const ORIGIN_ORDER = ["Nederland", "Europa", "Overig"];
  const seen = new Set<string>();
  for (const col of usableColumns) {
    for (const item of col.data!.migration!.breakdown) {
      seen.add(item.origin);
    }
  }
  const origins = [
    ...ORIGIN_ORDER.filter((o) => seen.has(o)),
    ...[...seen].filter((o) => !ORIGIN_ORDER.includes(o)),
  ];

  // For each origin, look up each column's percentage (0 if missing).
  const grouped = origins.map((origin) => ({
    origin,
    bars: columns.map((col) => {
      const found = col.data?.migration?.breakdown.find((b) => b.origin === origin);
      return { color: col.color, percentage: found?.percentage ?? 0 };
    }),
  }));

  // Y-axis max — the highest single bar across all groups.
  const yMax = Math.max(
    1,
    ...grouped.flatMap((g) => g.bars.map((b) => b.percentage))
  );

  // Use the first available year for the subtitle. All buurts in a given
  // dataset share the same source year in practice.
  const year = usableColumns[0]?.data?.migration?.year;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-800">
        Migration — herkomst{year ? ` ${year}` : ""}
      </h3>
      <p className="mt-0.5 text-[11px] text-gray-400">
        % of inhabitants. Bars grouped per origin.
      </p>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-600">
        {columns.map((col) => (
          <span key={col.entry.query} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: col.color }}
            />
            {col.entry.label}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-5 px-1" style={{ minHeight: 130 }}>
        {grouped.map(({ origin, bars }) => (
          <div key={origin} className="flex-1 text-center text-[10px] text-gray-600">
            <div className="flex h-[100px] items-end justify-center gap-1">
              {bars.map((bar, i) => (
                <div
                  key={i}
                  className="relative w-3.5 rounded-t-sm"
                  style={{
                    height: `${(bar.percentage / yMax) * 100}%`,
                    backgroundColor: bar.color,
                  }}
                >
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-gray-500">
                    {bar.percentage.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 truncate" title={origin}>
              {origin}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
