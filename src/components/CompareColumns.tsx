"use client";

import type { CompareEntry } from "@/lib/types";

export interface CompareColumn {
  entry: CompareEntry;
  color: string;
  sublabel?: string; // e.g. data.location
}

interface CompareColumnsProps {
  columns: CompareColumn[];
  onRemove: (query: string) => void;
}

function badgeClasses(kind: CompareEntry["kind"]): string {
  if (kind === "postcode") return "bg-gray-100 text-gray-600";
  return "bg-orange-50 text-orange-600";
}

export default function CompareColumns({
  columns,
  onRemove,
}: CompareColumnsProps) {
  return (
    <div
      className="grid items-end gap-3 border-b border-gray-100 py-3"
      style={{
        gridTemplateColumns: `200px repeat(${columns.length}, minmax(0, 1fr))`,
      }}
    >
      <div />
      {columns.map(({ entry, color, sublabel }) => (
        <div
          key={entry.query}
          className="relative rounded-lg border border-gray-100 px-3 py-3"
          style={{ borderTop: `4px solid ${color}` }}
        >
          <button
            type="button"
            onClick={() => onRemove(entry.query)}
            aria-label={`Remove ${entry.label}`}
            className="absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-700"
          >
            ✕
          </button>
          <h4 className="text-sm font-bold text-gray-900">
            {entry.label}
            <span
              className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold lowercase ${badgeClasses(
                entry.kind
              )}`}
            >
              {entry.kind}
            </span>
          </h4>
          {sublabel && (
            <p className="mt-0.5 text-xs text-gray-500">{sublabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}
