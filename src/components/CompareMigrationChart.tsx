"use client";

import type { PostcodeData, CompareEntry } from "@/lib/types";

export interface MigrationColumn {
  entry: CompareEntry;
  color: string;
  data: PostcodeData | null;
}

interface CompareMigrationChartProps {
  columns: MigrationColumn[];
}

const ORIGIN_COLORS = ["#E65100", "#FF8A65", "#FFCCBC"];

export default function CompareMigrationChart({
  columns,
}: CompareMigrationChartProps) {
  const usableColumns = columns.filter(
    (c) => c.data?.migration?.breakdown?.length
  );
  if (usableColumns.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-800">Migration — herkomst</h3>
      <p className="mt-0.5 text-[11px] text-gray-400">
        Stacked breakdown per area.
      </p>

      <div
        className="mt-4 grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${usableColumns.length}, minmax(0, 1fr))`,
        }}
      >
        {usableColumns.map((col) => {
          const breakdown = col.data!.migration!.breakdown;
          return (
            <div key={col.entry.query} className="text-[11px]">
              <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-gray-800">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: col.color }}
                />
                {col.entry.label}
                <span className="ml-auto text-[10px] font-normal text-gray-400">
                  {col.data!.migration!.year}
                </span>
              </div>

              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {breakdown.map((item, i) => (
                  <div
                    key={item.origin}
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: ORIGIN_COLORS[i % ORIGIN_COLORS.length],
                    }}
                  />
                ))}
              </div>

              <ul className="mt-2 space-y-0.5">
                {breakdown.map((item, i) => (
                  <li key={item.origin} className="flex items-center gap-2 text-[10px] text-gray-600">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: ORIGIN_COLORS[i % ORIGIN_COLORS.length] }}
                    />
                    <span className="flex-1 truncate" title={item.origin}>
                      {item.origin}
                    </span>
                    <span className="text-gray-400">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
