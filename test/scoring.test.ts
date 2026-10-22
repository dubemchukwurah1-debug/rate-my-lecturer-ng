import { describe, expect, it } from "vitest";
import { aggregate, type ScoredReview } from "@/lib/scoring";

const now = new Date("2026-10-22T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const review = (overall: number, age: number, extra: Partial<ScoredReview> = {}): ScoredReview => ({
  overall,
  clarity: null,
  fairness: null,
  availability: null,
  respect: null,
  createdAt: daysAgo(age),
  ...extra,
});

describe("aggregate", () => {
  it("hides the score until there are five reviews", () => {
    expect(aggregate([1, 2, 3, 4].map((s) => review(s, 1)), now)).toBeNull();
    expect(aggregate([1, 2, 3, 4, 5].map((s) => review(s, 1)), now)?.overall).toBe(3);
  });

  it("weights recent reviews more", () => {
    const reviews = [review(5, 1), review(5, 1), review(1, 730), review(1, 730), review(1, 730)];
    // Two-year-old reviews weigh a quarter as much, so the score leans to 5.
    expect(aggregate(reviews, now)!.overall).toBeGreaterThan(3.5);
  });

  it("drops reviews older than five years", () => {
    const reviews = [...[5, 5, 5, 5].map((s) => review(s, 10)), review(1, 6 * 365)];
    expect(aggregate(reviews, now)).toBeNull();
  });

  it("averages only the sub-scores that were given", () => {
    const reviews = [1, 2, 3, 4, 5].map((s, i) => review(s, 1, i < 2 ? { clarity: 4 } : {}));
    expect(aggregate(reviews, now)!.subScores).toEqual({ clarity: 4 });
  });
});
