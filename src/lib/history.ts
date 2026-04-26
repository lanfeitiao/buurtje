import type { HistoryEntry } from "@/lib/types";

const KEY = "buurtje:search-history";
const MAX_ENTRIES = 50;

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

function normalize(query: string): string {
  return query.trim().toLowerCase();
}

export function addToHistory(entry: HistoryEntry): void {
  if (!hasStorage()) return;
  try {
    const norm = normalize(entry.query);
    const current = readHistory().filter((e) => normalize(e.query) !== norm);
    const merged = [entry, ...current];

    let next = merged;
    if (next.length > MAX_ENTRIES) {
      // Drop the entries with the lowest timestamps until we're at the cap.
      next = [...merged].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ENTRIES);
    }

    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // silent
  }
}

export function removeFromHistory(query: string): void {
  if (!hasStorage()) return;
  try {
    const norm = normalize(query);
    const next = readHistory().filter((e) => normalize(e.query) !== norm);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // silent
  }
}

export function clearHistory(): void {
  // implemented in a later step
}
