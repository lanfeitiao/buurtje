import type { CompareEntry } from "@/lib/types";

const KEY = "buurtje:compare-set";
const MAX_ENTRIES = 4;

function hasStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readCompareSet(): CompareEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CompareEntry[];
  } catch {
    return [];
  }
}

function normalize(query: string): string {
  return query.trim().toLowerCase();
}

export function addToCompareSet(entry: CompareEntry): void {
  if (!hasStorage()) return;
  try {
    const norm = normalize(entry.query);
    const current = readCompareSet();
    if (current.some((e) => normalize(e.query) === norm)) {
      return;
    }
    const merged = [...current, entry];

    let next = merged;
    if (next.length > MAX_ENTRIES) {
      next = [...merged]
        .sort((a, b) => a.addedAt - b.addedAt)
        .slice(merged.length - MAX_ENTRIES);
    }

    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // silent
  }
}

export function removeFromCompareSet(_query: string): void {
  // implemented in a later step
}

export function clearCompareSet(): void {
  // implemented in a later step
}

export function isInCompareSet(_query: string): boolean {
  // implemented in a later step
  return false;
}
