import type { CompareEntry } from "@/lib/types";
import { normalizeQuery } from "@/lib/queryNormalize";

const KEY = "buurtje:compare-set";
const MAX_ENTRIES = 4;

function hasStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isCompareEntry(value: unknown): value is CompareEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.query === "string" &&
    typeof e.label === "string" &&
    (e.kind === "postcode" || e.kind === "buurt" || e.kind === "wijk") &&
    typeof e.addedAt === "number"
  );
}

export function readCompareSet(): CompareEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCompareEntry);
  } catch {
    return [];
  }
}

export function addToCompareSet(entry: CompareEntry): void {
  if (!hasStorage()) return;
  try {
    const norm = normalizeQuery(entry.query);
    const current = readCompareSet();
    if (current.some((e) => normalizeQuery(e.query) === norm)) {
      return;
    }
    const merged = [...current, entry];

    let next = merged;
    if (next.length > MAX_ENTRIES) {
      // Drop the entries with the lowest addedAt until we're at the cap.
      next = [...merged]
        .sort((a, b) => a.addedAt - b.addedAt)
        .slice(merged.length - MAX_ENTRIES);
    }

    localStorage.setItem(KEY, JSON.stringify(next));
    notifyChange();
  } catch {
    // silent
  }
}

export function removeFromCompareSet(query: string): void {
  if (!hasStorage()) return;
  try {
    const norm = normalizeQuery(query);
    const next = readCompareSet().filter((e) => normalizeQuery(e.query) !== norm);
    localStorage.setItem(KEY, JSON.stringify(next));
    notifyChange();
  } catch {
    // silent
  }
}

export function clearCompareSet(): void {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(KEY);
    notifyChange();
  } catch {
    // silent
  }
}

export function isInCompareSet(query: string): boolean {
  const norm = normalizeQuery(query);
  return readCompareSet().some((e) => normalizeQuery(e.query) === norm);
}

function notifyChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("buurtje:compare-changed"));
  } catch {
    // silent
  }
}

export const COMPARE_PALETTE = [
  "#E65100", // brand orange
  "#FF8A65", // peach
  "#90CAF9", // light blue
  "#A5D6A7", // sage green
];

export function getCompareColor(index: number): string {
  return COMPARE_PALETTE[index % COMPARE_PALETTE.length];
}
