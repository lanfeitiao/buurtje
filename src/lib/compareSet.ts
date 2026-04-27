import type { CompareEntry } from "@/lib/types";

const KEY = "buurtje:compare-set";

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

export function addToCompareSet(entry: CompareEntry): void {
  if (!hasStorage()) return;
  try {
    const current = readCompareSet();
    const next = [...current, entry];
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
