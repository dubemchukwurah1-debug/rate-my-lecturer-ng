// Aggregate scores shown on a staff profile. A score appears only once enough
// reviews exist, recent reviews weigh more, and reviews older than five years drop out.

export const MIN_REVIEWS_FOR_SCORE = 5;
const ARCHIVE_AFTER_YEARS = 5;
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export interface ScoredReview {
  overall: number;
  clarity: number | null;
  fairness: number | null;
  availability: number | null;
  respect: number | null;
  createdAt: Date;
}

export type SubScore = "clarity" | "fairness" | "availability" | "respect";

export interface Aggregate {
  overall: number;
  subScores: Partial<Record<SubScore, number>>;
  reviewCount: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function aggregate(reviews: ScoredReview[], now = new Date()): Aggregate | null {
  const live = reviews.filter((r) => (now.getTime() - r.createdAt.getTime()) / YEAR_MS < ARCHIVE_AFTER_YEARS);
  if (live.length < MIN_REVIEWS_FOR_SCORE) return null;

  // Each year of age halves a review's weight.
  const weight = (r: ScoredReview) => 0.5 ** Math.max(0, (now.getTime() - r.createdAt.getTime()) / YEAR_MS);
  const weighted = (pick: (r: ScoredReview) => number | null) => {
    let sum = 0;
    let total = 0;
    for (const r of live) {
      const v = pick(r);
      if (v == null) continue;
      sum += v * weight(r);
      total += weight(r);
    }
    return total === 0 ? undefined : round1(sum / total);
  };

  const subScores: Aggregate["subScores"] = {};
  for (const key of ["clarity", "fairness", "availability", "respect"] as const) {
    const v = weighted((r) => r[key]);
    if (v !== undefined) subScores[key] = v;
  }
  return { overall: weighted((r) => r.overall)!, subScores, reviewCount: live.length };
}
