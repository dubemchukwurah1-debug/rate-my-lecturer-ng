// Pre-publish checks for anything students write. Personal data and abuse are
// blocked; text that alleges a crime is redirected to the flag/report flow, where
// it gets panel review instead of being posted as an ordinary review.

export type CheckIssue = "phone_number" | "email_address" | "abusive_language" | "crime_allegation";

export interface CheckResult {
  ok: boolean;
  issues: CheckIssue[];
  redirectToReport: boolean;
}

const PHONE = /(?:\+?234|\b0)[789][01]\d{8}\b/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

// Kept short on purpose; the moderation team extends these lists.
const ABUSIVE = [/\bidiot\b/i, /\bstupid\b/i, /\bmumu\b/i, /\bwerey\b/i, /\bbastard\b/i, /\bfool\b/i];

const CRIME_ALLEGATION = [
  /sex[\s-]*for[\s-]*(marks|grades)/i,
  /\bsorting\b/i,
  /\b(collect|collects|collected|demand|demands|demanded|ask(?:s|ed)? for)\b.{0,30}\b(money|cash|naira|bribe)\b/i,
  /\bbribe(s|d)?\b/i,
  /\b(rape|raped|rapist)\b/i,
  /\bsexual(ly)? harass/i,
  /\bharass(ed|es|ing|ment)?\b/i,
  /\bassault(ed|s)?\b/i,
  /\btouched me\b/i,
  /\bthreaten(ed|s|ing)?\b/i,
];

export function checkText(text: string): CheckResult {
  const issues: CheckIssue[] = [];
  const compact = text.replace(/[\s-]/g, "");
  if (PHONE.test(compact)) issues.push("phone_number");
  if (EMAIL.test(text)) issues.push("email_address");
  if (ABUSIVE.some((re) => re.test(text))) issues.push("abusive_language");
  const redirectToReport = CRIME_ALLEGATION.some((re) => re.test(text));
  if (redirectToReport) issues.push("crime_allegation");
  return { ok: issues.length === 0, issues, redirectToReport };
}

export const ISSUE_MESSAGES: Record<CheckIssue, string> = {
  phone_number: "Remove phone numbers. Reviews must not contain anyone's contact details.",
  email_address: "Remove email addresses. Reviews must not contain anyone's contact details.",
  abusive_language: "Remove insults. Describe what happened instead.",
  crime_allegation:
    "This sounds like serious misconduct. Please file it as a private report instead, so it gets proper review and you get support.",
};
