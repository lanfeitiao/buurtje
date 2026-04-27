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
    notifyChange();
  } catch {
    // silent
  }
}

export function removeFromCompareSet(query: string): void {
  if (!hasStorage()) return;
  try {
    const norm = normalize(query);
    const next = readCompareSet().filter((e) => normalize(e.query) !== norm);
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
  const norm = normalize(query);
  return readCompareSet().some((e) => normalize(e.query) === norm);
}

function notifyChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("buurtje:compare-changed"));
  } catch {
    // silent
  }
}
