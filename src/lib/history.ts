import type { HistoryEntry } from "@/lib/types";

const KEY = "buurtje:search-history";

function hasStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readHistory(): HistoryEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function addToHistory(entry: HistoryEntry): void {
  if (!hasStorage()) return;
  try {
    const current = readHistory();
    const next = [entry, ...current];
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // silent
  }
}

export function removeFromHistory(_query: string): void {
  // implemented in a later step
}

export function clearHistory(): void {
  // implemented in a later step
}
