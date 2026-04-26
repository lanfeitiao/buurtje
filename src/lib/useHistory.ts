"use client";

import { useEffect, useState, useCallback } from "react";
import {
  readHistory,
  removeFromHistory,
  clearHistory,
} from "@/lib/history";
import type { HistoryEntry } from "@/lib/types";

export function useHistory(): {
  entries: HistoryEntry[];
  remove: (query: string) => void;
  clear: () => void;
} {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // localStorage is unavailable during SSR — bootstrap the client-side
    // snapshot inside the effect rather than during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(readHistory());

    function refresh() {
      setEntries(readHistory());
    }

    window.addEventListener("buurtje:history-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("buurtje:history-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const remove = useCallback((query: string) => {
    removeFromHistory(query);
  }, []);

  const clear = useCallback(() => {
    clearHistory();
  }, []);

  return { entries, remove, clear };
}
