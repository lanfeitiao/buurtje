const PDOK_BASE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pdokSearch(query: string, fq: string, fl?: string): Promise<any> {
  const params = new URLSearchParams({ q: query, fq, rows: "1" });
  if (fl) params.set("fl", fl);
  const res = await fetch(`${PDOK_BASE}/free?${params}`);
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((await res.json()) as any).response?.docs?.[0] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pdokReverse(lat: number, lon: number): Promise<any> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    rows: "1",
    type: "adres",
    fl: "postcode,weergavenaam",
  });
  const res = await fetch(`${PDOK_BASE}/reverse?${params}`);
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((await res.json()) as any).response?.docs?.[0] ?? null;
}

function parseCoords(centroide: string): { lat: number; lon: number } | null {
  const m = centroide.match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
  return m ? { lon: parseFloat(m[1]), lat: parseFloat(m[2]) } : null;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export type SearchResult =
  | { kind: "postcode"; code: string; label?: string }
  | {
      kind: "area";
      areaType: "buurt" | "wijk";
      slug: string;
      code: string;
      areaCode: string;
      label: string;
      buurtName?: string;          // populated only on the address path
      geometrieWkt: string;
    };

export type MapContext =
  | { kind: "postcode"; code: string }
  | { kind: "buurt" | "wijk"; geometrieWkt: string; label: string };

export async function resolveQuery(query: string): Promise<SearchResult> {
  if (/^\d{4}$/.test(query)) {
    return { kind: "postcode", code: query };
  }

  // Full Dutch postcode (e.g. "1012LG" or "1012 LG"). Treat as a postcode
  // search — otherwise the address-shape heuristic below would route it
  // through PDOK's adres endpoint and we'd land in a buurt instead of the
  // postcode the user explicitly typed.
  const dutchPostcode = query.match(/^(\d{4})\s*[A-Z]{2}$/i);
  if (dutchPostcode) {
    return { kind: "postcode", code: dutchPostcode[1] };
  }

  // PDOK's buurt/wijk endpoint matches greedily on tokens, so an address
  // query like "Damrak 1 Amsterdam" gets hijacked by an unrelated buurt
  // ("Gein 1 Amsterdam"). When the query looks address-shaped — has both a
  // digit and a letter — try the address branch first and fall through to
  // buurt/wijk only if it didn't yield anything useful.
  const isAddressShape = /\d/.test(query) && /[a-z]/i.test(query);

  // Helper: try resolving as an address. Returns a SearchResult if PDOK
  // gives us either full buurt info (preferred — yields kind:"area") or
  // just a postcode (fallback — yields kind:"postcode").
  const tryAddress = async (): Promise<SearchResult | null> => {
    const adresDoc = await pdokSearch(
      query,
      "type:adres",
      "postcode,weergavenaam,buurtcode,buurtnaam,wijkcode,wijknaam,gemeentenaam"
    );
    if (
      adresDoc?.buurtcode &&
      adresDoc?.buurtnaam &&
      adresDoc?.gemeentenaam &&
      adresDoc?.postcode
    ) {
      // PDOK adres docs carry the address point in geometrie_ll, not the
      // buurt polygon, so a follow-up call by buurtcode is needed for AreaMap.
      const buurtDoc = await pdokSearch(
        adresDoc.buurtcode,
        "type:buurt",
        "geometrie_ll"
      );
      const slug = `${toSlug(adresDoc.buurtnaam)}-${toSlug(adresDoc.gemeentenaam)}`;
      return {
        kind: "area",
        areaType: "buurt",
        slug,
        code: adresDoc.postcode.substring(0, 4),
        areaCode: adresDoc.buurtcode,
        label: adresDoc.weergavenaam,
        buurtName: adresDoc.buurtnaam,
        geometrieWkt: buurtDoc?.geometrie_ll ?? "",
      };
    }
    if (adresDoc?.postcode) {
      return {
        kind: "postcode",
        code: adresDoc.postcode.substring(0, 4),
        label: adresDoc.weergavenaam,
      };
    }
    return null;
  };

  if (isAddressShape) {
    const addressResult = await tryAddress();
    if (addressResult) return addressResult;
  }

  // Try as buurt/wijk (the original step 1)
  const buurtDoc = await pdokSearch(
    query,
    "type:buurt OR type:wijk",
    "weergavenaam,centroide_ll,geometrie_ll,buurtnaam,wijknaam,gemeentenaam,type,buurtcode,wijkcode"
  );
  if (buurtDoc?.centroide_ll && buurtDoc?.gemeentenaam) {
    const coords = parseCoords(buurtDoc.centroide_ll);
    if (coords) {
      const reverseDoc = await pdokReverse(coords.lat, coords.lon);
      const code = reverseDoc?.postcode?.substring(0, 4) ?? "0000";
      const areaType = buurtDoc.type as "buurt" | "wijk";
      const name = areaType === "buurt" ? buurtDoc.buurtnaam : buurtDoc.wijknaam;
      const slug = `${toSlug(name)}-${toSlug(buurtDoc.gemeentenaam)}`;
      const areaCode =
        areaType === "buurt" ? buurtDoc.buurtcode : buurtDoc.wijkcode;
      return {
        kind: "area",
        areaType,
        slug,
        code,
        areaCode: areaCode || "",
        label: buurtDoc.weergavenaam,
        geometrieWkt: buurtDoc.geometrie_ll ?? "",
      };
    }
  }

  // Non-address-shaped queries try the address branch as a fallback (covers
  // the rare case where a name-shaped query happens to be an address).
  if (!isAddressShape) {
    const addressResult = await tryAddress();
    if (addressResult) return addressResult;
  }

  // Try as woonplaats (unchanged)
  const plaatsDoc = await pdokSearch(query, "type:woonplaats", "weergavenaam,centroide_ll");
  if (plaatsDoc?.centroide_ll) {
    const coords = parseCoords(plaatsDoc.centroide_ll);
    if (coords) {
      const reverseDoc = await pdokReverse(coords.lat, coords.lon);
      if (reverseDoc?.postcode) {
        return {
          kind: "postcode",
          code: reverseDoc.postcode.substring(0, 4),
          label: plaatsDoc.weergavenaam,
        };
      }
    }
  }

  throw new Error("Address not found");
}
