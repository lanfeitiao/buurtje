"use client";

import Link from "next/link";
import { useCompareSet } from "@/lib/useCompareSet";

export default function CompareSetChip() {
  const { count } = useCompareSet();
  if (count < 1) return null;

  return (
    <Link
      href="/compare"
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-semibold text-white"
      style={{ backgroundColor: "#E65100" }}
    >
      <span>Compare</span>
      <span
        className="rounded-full bg-white px-1.5 text-xs font-extrabold"
        style={{ color: "#E65100" }}
      >
        {count}
      </span>
    </Link>
  );
}
