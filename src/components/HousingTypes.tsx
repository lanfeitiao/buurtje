import { PostcodeData } from "@/lib/types";

interface HousingTypesProps {
  data: PostcodeData;
}

interface BarRowProps {
  label: string;
  percentage: number;
  color: string;
}

function BarRow({ label, percentage, color }: BarRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function HousingTypes({ data }: HousingTypesProps) {
  const { housingTypes } = data;
  const { koop, huur } = housingTypes.ownership;
  const total = koop + huur;
  const koopPct = total > 0 ? (koop / total) * 100 : 0;
  const huurPct = total > 0 ? (huur / total) * 100 : 0;

  const buildingEntries = Object.entries(housingTypes.buildingType);
  const buildingTotal = buildingEntries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
        Housing Types
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Ownership */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase text-gray-400">
            Ownership
          </p>
          <div className="space-y-3">
            <BarRow label="Koop" percentage={koopPct} color="#E65100" />
            <BarRow label="Huur" percentage={huurPct} color="#FF8A65" />
          </div>
        </div>

        {/* Building type */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase text-gray-400">
            Building Type
          </p>
          <div className="space-y-3">
            {buildingEntries.map(([type, count], i) => {
              const pct = buildingTotal > 0 ? (count / buildingTotal) * 100 : 0;
              const colors = ["#E65100", "#FF8A65", "#FFCCBC", "#BF360C", "#FF7043"];
              return (
                <BarRow
                  key={type}
                  label={type}
                  percentage={pct}
                  color={colors[i % colors.length]}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
