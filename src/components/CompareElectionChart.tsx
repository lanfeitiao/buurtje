"use client";

import type { PostcodeData, CompareEntry } from "@/lib/types";

export interface ElectionColumn {
  entry: CompareEntry;
  color: string;
  data: PostcodeData | null;
}

interface CompareElectionChartProps {
  columns: ElectionColumn[];
}

const TOP_N = 5;

function shortName(party: string): string {
  const map: Record<string, string> = {
    "GROENLINKS / Partij van de Arbeid (PvdA)": "GL-PvdA",
    "PVV (Partij voor de Vrijheid)": "PVV",
    "SP (Socialistische Partij)": "SP",
    "Partij voor de Dieren": "PvdD",
  };
  return map[party] || party;
}

export default function CompareElectionChart({ columns }: CompareElectionChartProps) {
  // Build a map of party -> max(percentage across columns) and pick top N.
  const partyMax = new Map<string, number>();
  for (const col of columns) {
    if (!col.data?.election) continue;
    for (const p of col.data.election.parties) {
      partyMax.set(p.name, Math.max(partyMax.get(p.name) ?? 0, p.percentage));
    }
  }

  if (partyMax.size === 0) return null;

  const topParties = [...partyMax.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([name]) => name);

  // For each party, look up each column's percentage (or 0 if missing).
  const grouped = topParties.map((party) => ({
    party,
    bars: columns.map((col) => {
      const found = col.data?.election?.parties.find((p) => p.name === party);
      return { color: col.color, percentage: found?.percentage ?? 0 };
    }),
  }));

  // Y-axis max — the highest single bar across all groups.
  const yMax = Math.max(
    1,
    ...grouped.flatMap((g) => g.bars.map((b) => b.percentage))
  );

  // Postcode fallback annotations.
  const fallbacks = columns
    .filter((c) => c.data?.election?.source.kind === "postcode")
    .map((c) => {
      const src = c.data!.election!.source as { kind: "postcode"; code: string };
      return { label: c.entry.label, code: src.code };
    });

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-800">
        Tweede Kamer — top parties
      </h3>
      <p className="mt-0.5 text-[11px] text-gray-400">
        % of valid votes. Bars grouped per party.
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
        {grouped.map(({ party, bars }) => (
          <div key={party} className="flex-1 text-center text-[10px] text-gray-600">
            <div className="flex h-[100px] items-end justify-center gap-1">
              {bars.map((bar, i) => (
                <div key={i} className="relative w-3.5 rounded-t-sm" style={{ height: `${(bar.percentage / yMax) * 100}%`, backgroundColor: bar.color }}>
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-gray-500">
                    {bar.percentage.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 truncate" title={party}>
              {shortName(party)}
            </div>
          </div>
        ))}
      </div>

      {fallbacks.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-[10px] text-gray-400">
          {fallbacks.map((f) => (
            <li key={f.label}>
              {f.label} — no polling stations in this area, using postcode {f.code} fallback.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
