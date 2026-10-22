import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import type postgres from "postgres";
import { checkText, type CheckIssue } from "./content-checks";
import { spendToken } from "./tokens";

export const FACILITY_CATEGORIES = [
  "Hostels",
  "Water and power",
  "Lecture halls",
  "Labs and equipment",
  "Library and internet",
  "Toilets and sanitation",
  "Health centre",
  "Security and lighting",
  "Transport",
  "Accessibility",
] as const;

export const facilitySchema = z.object({
  institutionSlug: z.string().min(1),
  category: z.enum(FACILITY_CATEGORIES),
  title: z.string().trim().min(10).max(120),
  description: z.string().trim().min(30).max(2000),
  location: z.string().trim().max(120).optional(),
});

export type FacilityInput = z.infer<typeof facilitySchema>;

export async function postFacilityIssue(
  sql: postgres.Sql,
  input: FacilityInput,
  token: { msg: string; sig: string },
): Promise<{ status: "posted"; id: string } | { status: "rejected"; issues: CheckIssue[] }> {
  // Facility posts criticise places, not people, so allegations are fine here; only
  // personal data and abuse are blocked.
  const issues = checkText(`${input.title}\n${input.description}`).issues.filter((i) => i !== "crime_allegation");
  if (issues.length > 0) return { status: "rejected", issues };

  return sql.begin(async (tx) => {
    const [inst] = await tx`select id from institutions where slug = ${input.institutionSlug}`;
    if (!inst) throw new Error("Unknown institution");
    await spendToken(tx, token);
    const [row] = await tx`
      insert into facility_issues (institution_id, category, title, description, location)
      values (${inst.id}, ${input.category}, ${input.title}, ${input.description}, ${input.location ?? null})
      returning id`;
    return { status: "posted" as const, id: row.id as string };
  });
}

// One upvote per account per issue, stored as a keyed hash so votes cannot be
// joined back to accounts without the server secret.
export async function upvoteFacilityIssue(sql: postgres.Sql, issueId: string, userId: string): Promise<boolean> {
  const secret = process.env.UPVOTE_SECRET;
  if (!secret) throw new Error("UPVOTE_SECRET must be set");
  const voterHash = createHmac("sha256", secret).update(`${userId}:${issueId}`).digest();
  return sql.begin(async (tx) => {
    const inserted = await tx`
      insert into facility_upvotes (issue_id, voter_hash) values (${issueId}, ${voterHash})
      on conflict do nothing returning 1`;
    if (inserted.length === 0) return false;
    await tx`update facility_issues set upvotes = upvotes + 1 where id = ${issueId}`;
    return true;
  });
}
