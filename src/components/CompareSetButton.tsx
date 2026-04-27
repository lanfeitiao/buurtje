"use client";

import { useCompareSet } from "@/lib/useCompareSet";
import type { CompareEntry } from "@/lib/types";

interface CompareSetButtonProps {
  query: string;
  label: string;
  kind: CompareEntry["kind"];
}

export default function CompareSetButton({
  query,
  label,
  kind,
}: CompareSetButtonProps) {
  const { add, remove, contains } = useCompareSet();
  const inSet = contains(query);

  function handleClick() {
    if (inSet) {
      remove(query);
    } else {
      add({ query, label, kind, addedAt: Date.now() });
    }
  }

  if (inSet) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="rounded-md border px-2.5 py-1 text-xs font-bold"
        style={{
          backgroundColor: "#FFF3E0",
          color: "#BF360C",
          borderColor: "#FFCCBC",
        }}
      >
        ✓ Added — remove
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border bg-white px-2.5 py-1 text-xs font-bold"
      style={{
        color: "#E65100",
        borderColor: "#E65100",
      }}
    >
      + Add to compare
    </button>
  );
}
