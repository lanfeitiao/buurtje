// Normalize a free-text query for case-insensitive, whitespace-insensitive
// comparison. Used by both the search-history and compare-set data layers
// (and their hooks/components) so the same query always maps to the same
// dedupe key regardless of how the user typed it.
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}
