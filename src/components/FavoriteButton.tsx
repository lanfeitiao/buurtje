"use client";

import { useFavorites } from "@/lib/useFavorites";
import type { FavoriteEntry } from "@/lib/types";

interface FavoriteButtonProps {
  query: string;
  label: string;
  kind: FavoriteEntry["kind"];
  city: string;
}

export default function FavoriteButton({
  query,
  label,
  kind,
  city,
}: FavoriteButtonProps) {
  const { add, remove, contains } = useFavorites();
  const inSet = contains(query);

  function handleClick() {
    if (inSet) {
      remove(query);
    } else {
      add({ query, label, kind, city, addedAt: Date.now() });
    }
  }

  if (inSet) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Remove from favorites"
        className="rounded-md border px-2.5 py-1 text-xs font-bold"
        style={{
          backgroundColor: "#FFF3E0",
          color: "#BF360C",
          borderColor: "#FFCCBC",
        }}
      >
        ♥ Saved
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Save to favorites"
      className="rounded-md border bg-white px-2.5 py-1 text-xs font-bold"
      style={{
        color: "#E65100",
        borderColor: "#E65100",
      }}
    >
      ♡ Save
    </button>
  );
}
