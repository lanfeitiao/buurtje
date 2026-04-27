"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useHistory } from "@/lib/useHistory";
import HistoryList from "@/components/HistoryList";

const MAX_ENTRIES = 50;

export default function HistoryPage() {
  const router = useRouter();
  const { entries, remove, clear } = useHistory();

  function handleSelect(query: string) {
    router.push(`/?q=${encodeURIComponent(query)}`);
  }

  function handleClearAll() {
    if (entries.length === 0) return;
    if (window.confirm("Clear all search history?")) {
      clear();
    }
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
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back
          </Link>
        </div>

        <div className="flex items-end justify-between px-5 pb-3 pt-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Search history
            </h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {entries.length} of {MAX_ENTRIES} saved
            </p>
          </div>
          {entries.length > 0 && (
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
        />
      </div>
    </main>
  );
}
