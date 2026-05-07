import type { FavoriteEntry } from "@/lib/types";
import { normalizeQuery } from "@/lib/queryNormalize";

const KEY = "buurtje:favorites";
const MAX_ENTRIES = 50;

function hasStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function isFavoriteEntry(value: unknown): value is FavoriteEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.query === "string" &&
    typeof e.label === "string" &&
    (e.kind === "postcode" || e.kind === "buurt" || e.kind === "wijk") &&
    typeof e.city === "string" &&
    typeof e.addedAt === "number"
  );
}

export function readFavorites(): FavoriteEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFavoriteEntry);
  } catch {
    return [];
  }
}

export function addFavorite(entry: FavoriteEntry): void {
  if (!hasStorage()) return;
  try {
    const norm = normalizeQuery(entry.query);
    const current = readFavorites();
    if (current.some((e) => normalizeQuery(e.query) === norm)) {
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

export function removeFavorite(query: string): void {
  if (!hasStorage()) return;
  try {
    const norm = normalizeQuery(query);
    const next = readFavorites().filter((e) => normalizeQuery(e.query) !== norm);
    localStorage.setItem(KEY, JSON.stringify(next));
    notifyChange();
  } catch {
    // silent
  }
}

export function clearFavorites(): void {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(KEY);
    notifyChange();
  } catch {
    // silent
  }
}

export function isFavorited(query: string): boolean {
  const norm = normalizeQuery(query);
  return readFavorites().some((e) => normalizeQuery(e.query) === norm);
}

function notifyChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("buurtje:favorites-changed"));
  } catch {
    // silent
  }
}
