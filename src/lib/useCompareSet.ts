"use client";

import { useEffect, useState, useCallback } from "react";
import {
  readCompareSet,
  addToCompareSet,
  removeFromCompareSet,
  clearCompareSet,
} from "@/lib/compareSet";
import { normalizeQuery } from "@/lib/queryNormalize";
import type { CompareEntry } from "@/lib/types";

export function useCompareSet(): {
  entries: CompareEntry[];
  count: number;
  add: (entry: CompareEntry) => void;
  remove: (query: string) => void;
  clear: () => void;
  contains: (query: string) => boolean;
} {
  const [entries, setEntries] = useState<CompareEntry[]>([]);

  useEffect(() => {
    // localStorage is unavailable during SSR — bootstrap inside the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(readCompareSet());

    function refresh() {
      setEntries(readCompareSet());
    }

    window.addEventListener("buurtje:compare-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("buurtje:compare-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const add = useCallback((entry: CompareEntry) => {
    addToCompareSet(entry);
  }, []);

  const remove = useCallback((query: string) => {
    removeFromCompareSet(query);
  }, []);

  const clear = useCallback(() => {
    clearCompareSet();
  }, []);

  const contains = useCallback(
    (query: string) => entries.some((e) => normalizeQuery(e.query) === normalizeQuery(query)),
    [entries]
  );

  return { entries, count: entries.length, add, remove, clear, contains };
}
