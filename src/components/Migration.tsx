import { PostcodeData } from "@/lib/types";

interface MigrationProps {
  data: PostcodeData;
}

const BAR_COLORS = ["#E65100", "#FF8A65", "#FFCCBC"];

export default function Migration({ data }: MigrationProps) {
  const { migration } = data;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
        Migration — Inwoners naar herkomst ({migration.year})
      </h2>

      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {migration.breakdown.map((item, i) => (
          <div
            key={item.origin}
            style={{
              width: `${item.percentage}%`,
              backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <ul className="mt-4 space-y-2">
        {migration.breakdown.map((item, i) => (
          <li key={item.origin} className="flex items-center gap-3 text-sm">
            <span
              className="h-3 w-3 flex-shrink-0 rounded-sm"
              style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
            />
            <span className="flex-1 text-gray-700">{item.origin}</span>
            <span className="text-gray-500">
              {item.count.toLocaleString("nl-NL")}
            </span>
            <span className="w-12 text-right text-gray-400">
              {item.percentage.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
