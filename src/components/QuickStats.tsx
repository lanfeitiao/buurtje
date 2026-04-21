import { PostcodeData } from "@/lib/types";

interface QuickStatsProps {
  data: PostcodeData;
}

interface StatTileProps {
  label: string;
  value: string;
  year: number;
}

function StatTile({ label, value, year }: StatTileProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <p
        className="mt-1 text-[22px] font-bold leading-tight"
        style={{ color: "#E65100" }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">{year}</p>
    </div>
  );
}

function formatEuro(n: number): string {
  return "€" + n.toLocaleString("nl-NL");
}

function formatNumber(n: number): string {
  return n.toLocaleString("nl-NL");
}

export default function QuickStats({ data }: QuickStatsProps) {
  const { quickStats } = data;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Avg WOZ Value"
        value={formatEuro(quickStats.wozValue.value)}
        year={quickStats.wozValue.year}
      />
      <StatTile
        label="Avg Income"
        value={formatEuro(quickStats.avgIncome.value)}
        year={quickStats.avgIncome.year}
      />
      <StatTile
        label="Population"
        value={formatNumber(quickStats.population.value)}
        year={quickStats.population.year}
      />
      <StatTile
        label="Households"
        value={formatNumber(quickStats.households.value)}
        year={quickStats.households.year}
      />
    </div>
  );
}
