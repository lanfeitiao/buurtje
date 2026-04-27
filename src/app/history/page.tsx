"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHistory } from "@/lib/useHistory";
import { useCompareSet } from "@/lib/useCompareSet";
import HistoryList from "@/components/HistoryList";
import CompareSetChip from "@/components/CompareSetChip";

const MAX_ENTRIES = 50;
const COMPARE_CAP = 4;

function normalize(query: string): string {
  return query.trim().toLowerCase();
}

export default function HistoryPage() {
  const router = useRouter();
  const { entries, remove, clear } = useHistory();
  const { clear: clearCompare, add: addCompare } = useCompareSet();

  const [mode, setMode] = useState<"navigate" | "select">("navigate");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function handleSelect(query: string) {
    router.push(`/?q=${encodeURIComponent(query)}`);
  }

  function handleClearAll() {
    if (entries.length === 0) return;
    if (window.confirm("Clear all search history?")) {
      clear();
    }
  }

  function handleToggleMode() {
    if (mode === "select") {
      setMode("navigate");
      setSelected(new Set());
    } else {
      setMode("select");
    }
  }

  function handleToggleEntry(query: string) {
    const norm = normalize(query);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(norm)) {
        next.delete(norm);
      } else if (next.size < COMPARE_CAP) {
        next.add(norm);
      }
      return next;
    });
  }

  function handleCompareSelected() {
    // Build the compare set from the selected entries, in original history
    // order. Use the entries array (not the sorted display order) so the
    // resulting columns reflect "added newest first" semantics consistent
    // with how the home page records history.
    const chosen = entries.filter((e) => selected.has(normalize(e.query)));
    if (chosen.length < 2) return;

    clearCompare();
    chosen.forEach((entry, i) => {
      addCompare({
        query: entry.query,
        label: entry.label,
        kind: entry.kind,
        addedAt: Date.now() + i, // unique addedAt per entry to preserve order
      });
    });

    router.push("/compare");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: "#E65100" }}
            />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Buurtje
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← Back
            </Link>
            <CompareSetChip />
            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleToggleMode}
                className={`rounded-md border px-2.5 py-1 text-xs font-bold ${
                  mode === "select" ? "bg-orange-50" : "bg-white"
                }`}
                style={{ color: "#E65100", borderColor: "#E65100" }}
              >
                {mode === "select" ? "Cancel" : "Compare"}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between px-5 pb-3 pt-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Search history
            </h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {entries.length} of {MAX_ENTRIES} saved
              {mode === "select" && selected.size > 0 && (
                <span className="ml-2 text-orange-600">
                  · {selected.size} of {COMPARE_CAP} selected
                </span>
              )}
            </p>
          </div>
          {entries.length > 0 && mode === "navigate" && (
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Clear all
            </button>
          )}
        </div>

        <HistoryList
          entries={entries}
          onSelect={handleSelect}
          onRemove={remove}
          mode={mode}
          selected={selected}
          onToggle={handleToggleEntry}
        />
      </div>

      {mode === "select" && selected.size >= 2 && (
        <div className="fixed bottom-6 right-6">
          <button
            type="button"
            onClick={handleCompareSelected}
            className="rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg"
            style={{ backgroundColor: "#E65100" }}
          >
            Compare selected ({selected.size})
          </button>
        </div>
      )}
    </main>
  );
}
