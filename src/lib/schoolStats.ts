import type { SchoolAdvies, SchoolIndexEntry, SchoolScore } from "./types";

// VWO% rounded to whole percent. Null when there's no advies row to read or
// when the row sums to zero (no graduates that year — happens for schools
// with very small or special-needs cohorts).
export function vwoPercent(a: SchoolAdvies | null): number | null {
  if (!a) return null;
  const total =
    a.speciaal_praktijk + a.vmbo_b_k + a.vmbo_t + a.havo + a.vwo + a.overig;
  if (total === 0) return null;
  return Math.round((a.vwo / total) * 100);
}

// "Low scoring" = no published latest score, OR the school's latest score
// is strictly below the gemeente average for the same toets and year.
//
// Strict (toets+year) match only — comparing across different years (school
// reported in 2020-2021, gemeente has 2024-2025) or different toets types
// (IEP vs Cito have totally different scales) would mislead. When no
// apples-to-apples comparison is possible we return false (don't flag).
export function isLowScoring(
  school: SchoolIndexEntry,
  gemeenteScores: SchoolScore[]
): boolean {
  if (!school.latestScore) return true;
  return isBelowAverage(school, gemeenteScores);
}

// Strictly "below the gemeente average" — requires a published score AND a
// matching gemeente baseline. Excludes the no-score case so it can be used
// for treatments that imply a numeric comparison (e.g. "lower than average").
export function isBelowAverage(
  school: SchoolIndexEntry,
  gemeenteScores: SchoolScore[]
): boolean {
  if (!school.latestScore) return false;
  const { toets, year, score } = school.latestScore;
  const baseline = gemeenteScores.find(
    (g) => g.toets === toets && g.year === year
  );
  if (!baseline) return false;
  return score < baseline.score;
}
