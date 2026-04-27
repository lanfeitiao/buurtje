"use client";

import { Fragment } from "react";

export type StatDirection = "higher" | "lower" | "none";

export interface StatRow {
  label: string;
  values: (number | null)[];
  format: (n: number) => string;
  direction: StatDirection;
}

export interface StatSection {
  heading: string;
  rows: StatRow[];
}

interface CompareStatTableProps {
  sections: StatSection[];
  columnCount: number;
}

function bestIndices(row: StatRow): Set<number> {
  if (row.direction === "none") return new Set();
  const valid = row.values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => typeof x.v === "number");
  if (valid.length === 0) return new Set();
  const target =
    row.direction === "higher"
      ? Math.max(...valid.map((x) => x.v))
      : Math.min(...valid.map((x) => x.v));
  return new Set(valid.filter((x) => x.v === target).map((x) => x.i));
}

export default function CompareStatTable({
  sections,
  columnCount,
}: CompareStatTableProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {sections.map((section) => (
          <Fragment key={section.heading}>
            <tr>
              <td
                colSpan={columnCount + 1}
                className="pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-gray-400"
              >
                {section.heading}
              </td>
            </tr>
            {section.rows.map((row) => {
              const best = bestIndices(row);
              return (
                <tr
                  key={`${section.heading}-${row.label}`}
                  className="border-b border-gray-100"
                >
                  <td className="sticky left-0 z-10 w-[200px] bg-white px-3 py-2.5 text-gray-600">
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className={`px-3 py-2.5 text-right ${
                        best.has(i)
                          ? "font-extrabold text-orange-600"
                          : "text-gray-700"
                      }`}
                    >
                      {v === null ? "—" : row.format(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
