import type { HistoryEntry } from "@/lib/types";
import { normalizeQuery } from "@/lib/queryNormalize";

const KEY = "buurtje:search-history";
const MAX_ENTRIES = 50;

function hasStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.query === "string" &&
    typeof e.label === "string" &&
    (e.kind === "postcode" || e.kind === "buurt" || e.kind === "wijk") &&
    typeof e.timestamp === "number"
  );
}

export function readHistory(): HistoryEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry);
  } catch {
    return [];
  }
}

export function addToHistory(entry: HistoryEntry): void {
  if (!hasStorage()) return;
  try {
    const norm = normalizeQuery(entry.query);
    const current = readHistory().filter((e) => normalizeQuery(e.query) !== norm);
    const merged = [entry, ...current];

    let next = merged;
    if (next.length > MAX_ENTRIES) {
      // Drop the entries with the lowest timestamps until we're at the cap.
      next = [...merged].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ENTRIES);
    }

    localStorage.setItem(KEY, JSON.stringify(next));
    notifyChange();
  } catch {
    // silent
  }
}

export function removeFromHistory(query: string): void {
  if (!hasStorage()) return;
  try {
    const norm = normalizeQuery(query);
    const next = readHistory().filter((e) => normalizeQuery(e.query) !== norm);
    localStorage.setItem(KEY, JSON.stringify(next));
    notifyChange();
  } catch {
    // silent
  }
}

export function clearHistory(): void {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(KEY);
    notifyChange();
  } catch {
    // silent
  }
}

function notifyChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("buurtje:history-changed"));
  } catch {
    // silent
  }
}
