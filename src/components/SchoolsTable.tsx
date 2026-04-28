"use client";

import { useEffect, useRef } from "react";
import type { SchoolIndexEntry } from "@/lib/types";
import { vwoPercent } from "@/lib/schoolStats";

export type SortState = { col: "vwo"; dir: "asc" | "desc" } | null;

interface SchoolsTableProps {
  schools: SchoolIndexEntry[] | null;
  // Schools whose latest score is strictly below the gemeente average. Used
  // to highlight the Score cell — schools without any score are not in this
  // set (no value to compare to).
  belowAverageSlugs: Set<string>;
  // Sortable header state (currently only VWO%).
  sort: SortState;
  onCycleSort: (col: "vwo") => void;
  // Denominatie filter — null means "no filter" (show all).
  availableDenominaties: string[];
  selectedDenominaties: Set<string> | null;
  onToggleDenominatie: (denom: string) => void;
  onSelectAllDenominaties: () => void;
  onClearAllDenominaties: () => void;
}

function isDenomChecked(
  selected: Set<string> | null,
  denom: string
): boolean {
  return selected === null ? true : selected.has(denom);
}

export default function SchoolsTable({
  schools,
  belowAverageSlugs,
  sort,
  onCycleSort,
  availableDenominaties,
  selectedDenominaties,
  onToggleDenominatie,
  onSelectAllDenominaties,
  onClearAllDenominaties,
}: SchoolsTableProps) {
  if (schools === null) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm text-gray-400">Loading schools…</p>
      </div>
    );
  }

  const denomFilterActive =
    selectedDenominaties !== null &&
    selectedDenominaties.size !== availableDenominaties.length;
  const sortActive = sort?.col === "vwo";
  const sortGlyph = !sortActive ? "↕" : sort.dir === "desc" ? "↓" : "↑";

  // Close the denominatie dropdown when the user clicks outside it. <details>
  // only closes via its own summary by default; this brings it in line with
  // typical popover behavior.
  const denomDetailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const el = denomDetailsRef.current;
      if (!el || !el.open) return;
      if (!el.contains(e.target as Node)) {
        el.open = false;
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

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
                <th className="px-4 py-2 text-left font-medium">
                  <details ref={denomDetailsRef} className="relative inline-block">
                    <summary
                      className={`-mx-1 inline-flex cursor-pointer list-none items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-gray-200 ${
                        denomFilterActive
                          ? "text-orange-600"
                          : "text-gray-500"
                      }`}
                      title="Click to filter"
                    >
                      Denominatie
                      {denomFilterActive
                        ? ` (${selectedDenominaties!.size}/${availableDenominaties.length})`
                        : ""}{" "}
                      <span aria-hidden>▾</span>
                    </summary>
                    <div className="absolute left-0 z-10 mt-1 max-h-72 w-64 overflow-auto rounded-md border border-gray-200 bg-white p-2 text-sm normal-case tracking-normal shadow-lg">
                      <div className="mb-1 flex justify-between border-b border-gray-100 pb-2 text-xs">
                        <button
                          type="button"
                          onClick={onSelectAllDenominaties}
                          className="text-gray-600 hover:underline"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={onClearAllDenominaties}
                          className="text-gray-600 hover:underline"
                        >
                          Clear all
                        </button>
                      </div>
                      {availableDenominaties.map((d) => (
                        <label
                          key={d}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={isDenomChecked(selectedDenominaties, d)}
                            onChange={() => onToggleDenominatie(d)}
                          />
                          <span className="text-gray-700">{d}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                </th>
                <th className="px-4 py-2 text-right font-medium">Leerlingen</th>
                <th className="px-4 py-2 text-right font-medium">Score</th>
                <th className="px-4 py-2 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => onCycleSort("vwo")}
                    className={`-mx-1 ml-auto inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs uppercase tracking-wide transition-colors hover:bg-gray-200 ${
                      sortActive ? "text-orange-600" : "text-gray-500"
                    }`}
                    title="Click to sort"
                  >
                    VWO%
                    <span
                      aria-hidden
                      className={
                        sortActive ? "text-orange-600" : "text-gray-400"
                      }
                    >
                      {sortGlyph}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schools.map((s) => {
                const vwo = vwoPercent(s.latestAdvies);
                const isBelow = belowAverageSlugs.has(s.slug);
                return (
                  <tr
                    key={s.slug}
                    className={
                      isBelow
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
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        isBelow ? "bg-red-100 text-red-900" : "text-gray-700"
                      }`}
                      title={isBelow ? "Below gemeente average" : undefined}
                    >
                      {s.latestScore ? (
                        <>
                          {s.latestScore.score}{" "}
                          <span
                            className={`text-xs ${
                              isBelow ? "text-red-700" : "text-gray-400"
                            }`}
                          >
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
