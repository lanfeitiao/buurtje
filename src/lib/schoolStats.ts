import type { SchoolIndexEntry, SchoolScore } from "./types";

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
  const { toets, year, score } = school.latestScore;
  const baseline = gemeenteScores.find(
    (g) => g.toets === toets && g.year === year
  );
  if (!baseline) return false;
  return score < baseline.score;
}
