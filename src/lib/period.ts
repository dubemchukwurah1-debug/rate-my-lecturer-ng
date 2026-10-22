// Token allowances reset every half-year. Nigerian semesters differ by school, so a
// fixed calendar period keeps the cap simple and the same for everyone.
export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-H${date.getUTCMonth() < 6 ? 1 : 2}`;
}
