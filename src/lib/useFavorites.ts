"use client";

import { useEffect, useState, useCallback } from "react";
import {
  readFavorites,
  addFavorite,
  removeFavorite,
  clearFavorites,
} from "@/lib/favorites";
import { normalizeQuery } from "@/lib/queryNormalize";
import type { FavoriteEntry } from "@/lib/types";

export function useFavorites(): {
  entries: FavoriteEntry[];
  count: number;
  add: (entry: FavoriteEntry) => void;
  remove: (query: string) => void;
  clear: () => void;
  contains: (query: string) => boolean;
} {
  const [entries, setEntries] = useState<FavoriteEntry[]>([]);

  useEffect(() => {
    // localStorage is unavailable during SSR — bootstrap inside the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(readFavorites());

    function refresh() {
      setEntries(readFavorites());
    }

    window.addEventListener("buurtje:favorites-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("buurtje:favorites-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const add = useCallback((entry: FavoriteEntry) => {
    addFavorite(entry);
  }, []);

  const remove = useCallback((query: string) => {
    removeFavorite(query);
  }, []);

  const clear = useCallback(() => {
    clearFavorites();
  }, []);

  const contains = useCallback(
    (query: string) =>
      entries.some((e) => normalizeQuery(e.query) === normalizeQuery(query)),
    [entries]
  );

  return { entries, count: entries.length, add, remove, clear, contains };
}
