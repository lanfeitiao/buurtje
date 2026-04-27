"use client";

import type { CompareDataColumn } from "@/lib/types";

interface CompareHousingTypesChartProps {
  columns: CompareDataColumn[];
}

const BUILDING_COLORS = ["#E65100", "#FF8A65", "#FFCCBC", "#BF360C", "#FF7043"];

export default function CompareHousingTypesChart({
  columns,
}: CompareHousingTypesChartProps) {
  const usableColumns = columns.filter((c) => {
    const map = c.data?.housingTypes?.buildingType;
    return map && Object.keys(map).length > 0;
  });
  if (usableColumns.length === 0) return null;

  // Shared key order — union of building-type names across all columns,
  // sorted by the largest sum across columns.
  const totals = new Map<string, number>();
  for (const col of usableColumns) {
    const map = col.data!.housingTypes!.buildingType;
    for (const [name, count] of Object.entries(map)) {
      totals.set(name, (totals.get(name) ?? 0) + count);
    }
  }
  const orderedTypes = [...totals.keys()].sort(
    (a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0)
  );

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-800">Building type</h3>
      <p className="mt-0.5 text-[11px] text-gray-400">
        Mix of building types per area.
      </p>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-600">
        {orderedTypes.map((name, i) => (
          <span key={name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: BUILDING_COLORS[i % BUILDING_COLORS.length] }}
            />
            {name}
          </span>
        ))}
      </div>

      <div
        className="mt-4 grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${usableColumns.length}, minmax(0, 1fr))`,
        }}
      >
        {usableColumns.map((col) => {
          const map = col.data!.housingTypes!.buildingType;
          const total = Object.values(map).reduce((sum, v) => sum + v, 0);
          return (
            <div key={col.entry.query} className="text-[11px]">
              <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-gray-800">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: col.color }}
                />
                {col.entry.label}
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {orderedTypes.map((name, i) => {
                  const count = map[name] ?? 0;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={name}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: BUILDING_COLORS[i % BUILDING_COLORS.length],
                      }}
                      title={`${name}: ${pct.toFixed(1)}%`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
