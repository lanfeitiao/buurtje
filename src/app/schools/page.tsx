"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SchoolsMap from "@/components/SchoolsMap";
import type { SchoolIndexEntry } from "@/lib/types";

const GEMEENTEN = [
  { slug: "haarlem", label: "Haarlem" },
  { slug: "amsterdam", label: "Amsterdam" },
  { slug: "amstelveen", label: "Amstelveen" },
  { slug: "hilversum", label: "Hilversum" },
];

const VALID_SLUGS = new Set(GEMEENTEN.map((g) => g.slug));
const DEFAULT_SLUG = "haarlem";

function SchoolsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("gemeente");
  const slug = raw && VALID_SLUGS.has(raw) ? raw : DEFAULT_SLUG;

  const [buurten, setBuurten] = useState<GeoJSON.FeatureCollection | null>(null);
  const [schools, setSchools] = useState<SchoolIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBuurten(null);
    setSchools(null);
    setError(null);
    Promise.all([
      fetch(`/buurten/${slug}.json`).then((r) =>
        r.ok ? (r.json() as Promise<GeoJSON.FeatureCollection>) : Promise.reject(r.status)
      ),
      fetch(`/schools/${slug}/index.json`).then((r) =>
        r.ok ? (r.json() as Promise<SchoolIndexEntry[]>) : Promise.reject(r.status)
      ),
    ])
      .then(([b, s]) => {
        if (cancelled) return;
        setBuurten(b);
        setSchools(s);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load gemeente data");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function selectGemeente(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("gemeente", next);
    router.replace(`/schools?${params.toString()}`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: "#E65100" }}
            />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Buurtje · Schools
            </span>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold"
            style={{ color: "#E65100" }}
          >
            Home
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {GEMEENTEN.map((g) => {
            const active = g.slug === slug;
            return (
              <button
                key={g.slug}
                type="button"
                onClick={() => selectGemeente(g.slug)}
                className={
                  active
                    ? "rounded-md px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                }
                style={active ? { backgroundColor: "#E65100" } : undefined}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      ) : (
        <SchoolsMap buurten={buurten} schools={schools} />
      )}
    </main>
  );
}

export default function SchoolsPage() {
  return (
    <Suspense fallback={null}>
      <SchoolsPageContent />
    </Suspense>
  );
}
