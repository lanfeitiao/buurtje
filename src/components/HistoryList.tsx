"use client";

import Link from "next/link";
import type { HistoryEntry } from "@/lib/types";
import { normalizeQuery } from "@/lib/queryNormalize";

interface HistoryListProps {
  entries: HistoryEntry[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  mode?: "navigate" | "select";
  selected?: Set<string>;
  onToggle?: (query: string) => void;
}

function badgeClasses(kind: HistoryEntry["kind"]): string {
  if (kind === "postcode") return "bg-gray-100 text-gray-600";
  return "bg-orange-50 text-orange-600";
}

export default function HistoryList({
  entries,
  onSelect,
  onRemove,
  mode = "navigate",
  selected,
  onToggle,
}: HistoryListProps) {
  if (entries.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm font-medium text-gray-700">No searches yet</p>
        <p className="mt-1 text-xs text-gray-400">
          Try searching from the{" "}
          <Link href="/" className="font-semibold" style={{ color: "#E65100" }}>
            home page
          </Link>{" "}
          to start your history.
        </p>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );

  return (
    <ul className="divide-y divide-gray-100">
      {sorted.map((entry) => {
        const isSelected =
          mode === "select" && selected?.has(normalizeQuery(entry.query));

        function handleRowClick() {
          if (mode === "select") {
            onToggle?.(entry.query);
          } else {
            onSelect(entry.query);
          }
        }

        return (
          <li
            key={entry.query}
            className="flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-orange-50"
            onClick={handleRowClick}
          >
            <div className="flex items-center gap-3">
              {mode === "select" && (
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                    isSelected
                      ? "border-orange-600 text-white"
                      : "border-gray-300 bg-white text-transparent"
                  }`}
                  style={isSelected ? { backgroundColor: "#E65100" } : undefined}
                >
                  ✓
                </span>
              )}
              <span className="text-[15px] font-medium text-gray-900">
                {entry.label}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold lowercase ${badgeClasses(
                  entry.kind
                )}`}
              >
                {entry.kind}
              </span>
            </div>
            <button
              type="button"
              aria-label={`Remove ${entry.label}`}
              className="rounded px-2 py-1 text-base text-gray-400 hover:bg-red-50 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(entry.query);
              }}
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}
