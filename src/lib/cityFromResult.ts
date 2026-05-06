// Pure helpers for deriving a city (gemeente) string from search results.
// Used by callers immediately before persisting a favorite or history entry,
// so the storage layers stay domain-agnostic and never re-parse anything.

export function cityFromArea(result: { gemeente: string | undefined }): string {
  return result.gemeente?.trim() ?? "";
}

export function cityFromPostcodeData(location: string): string {
  const first = location.split(",")[0]?.trim() ?? "";
  return first === "Unknown" ? "" : first;
}
