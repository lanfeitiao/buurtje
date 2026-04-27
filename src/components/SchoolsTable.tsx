"use client";

import type { SchoolIndexEntry, SchoolAdvies } from "@/lib/types";

interface SchoolsTableProps {
  schools: SchoolIndexEntry[] | null;
  lowScoreSlugs: Set<string>;
}

function vwoPercent(a: SchoolAdvies | null): number | null {
  if (!a) return null;
  const total =
    a.speciaal_praktijk + a.vmbo_b_k + a.vmbo_t + a.havo + a.vwo + a.overig;
  if (total === 0) return null;
  return Math.round((a.vwo / total) * 100);
}

export default function SchoolsTable({
  schools,
  lowScoreSlugs,
}: SchoolsTableProps) {
  if (schools === null) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm text-gray-400">Loading schools…</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-700">
          Schools{" "}
          <span className="font-normal text-gray-400">({schools.length})</span>
        </h2>
      </div>
      {schools.length === 0 ? (
        <p className="p-5 text-sm text-gray-400">No schools to show.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Buurt</th>
                <th className="px-4 py-2 text-left font-medium">Denominatie</th>
                <th className="px-4 py-2 text-right font-medium">Leerlingen</th>
                <th className="px-4 py-2 text-right font-medium">Score</th>
                <th className="px-4 py-2 text-right font-medium">VWO%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schools.map((s) => {
                const vwo = vwoPercent(s.latestAdvies);
                const isLow = lowScoreSlugs.has(s.slug);
                return (
                  <tr
                    key={s.slug}
                    className={
                      isLow
                        ? "bg-red-50 hover:bg-red-100"
                        : "hover:bg-gray-50"
                    }
                  >
                    <td className="px-4 py-2 font-medium">
                      <a
                        href={`https://allecijfers.nl/basisschool/${s.slug}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                        style={{ color: "#E65100" }}
                      >
                        {s.name}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {s.buurt ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {s.denominatie ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {s.latestLeerlingen ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {s.latestScore ? (
                        <>
                          {s.latestScore.score}{" "}
                          <span className="text-xs text-gray-400">
                            {s.latestScore.toets}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {vwo !== null ? `${vwo}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
