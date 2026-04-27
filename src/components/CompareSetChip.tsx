"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompareSet } from "@/lib/useCompareSet";

export default function CompareSetChip() {
  const { count } = useCompareSet();
  const pathname = usePathname();
  if (count < 1) return null;

  const className =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-semibold text-white";
  const style = { backgroundColor: "#E65100" };
  const inner = (
    <>
      <span>Compare</span>
      <span
        className="rounded-full bg-white px-1.5 text-xs font-extrabold"
        style={{ color: "#E65100" }}
      >
        {count}
      </span>
    </>
  );

  // On `/compare`, the chip is a count indicator only — no self-navigation.
  if (pathname === "/compare") {
    return (
      <span className={className} style={style}>
        {inner}
      </span>
    );
  }

  return (
    <Link href="/compare" className={className} style={style}>
      {inner}
    </Link>
  );
}
