import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { checkText, type CheckIssue } from "./content-checks";
import { spendToken } from "./tokens";

// More reviews than this on one profile in one day are held for moderation.
export const BURST_LIMIT_PER_DAY = 5;

const stars = z.number().int().min(1).max(5);

export const tokenSchema = z.object({ msg: z.string().min(1), sig: z.string().min(1) });

export const reviewSchema = z.object({
  staffId: z.uuid(),
  courseCode: z
    .string()
    .trim()
    .max(12)
    .regex(/^[A-Za-z]{2,4}\s?\d{3}[A-Za-z]?$/, "Use a course code like CSC 201")
    .optional(),
  semester: z.string().trim().min(4).max(20),
  overall: stars,
  clarity: stars.optional(),
  fairness: stars.optional(),
  availability: stars.optional(),
  respect: stars.optional(),
  wouldTakeAgain: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
  body: z.string().trim().min(50).max(1000),
  isAlumni: z.boolean().default(false),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export type SubmitResult =
  | { status: "published"; id: string }
  | { status: "held"; id: string }
  | { status: "rejected"; issues: CheckIssue[]; redirectToReport: boolean };

export async function submitReview(
  sql: postgres.Sql,
  input: ReviewInput,
  token: z.infer<typeof tokenSchema>,
): Promise<SubmitResult> {
  const check = checkText(input.body);
  if (!check.ok) return { status: "rejected", issues: check.issues, redirectToReport: check.redirectToReport };

  return sql.begin(async (tx) => {
    const [staff] = await tx`select id from staff where id = ${input.staffId} and status = 'approved'`;
    if (!staff) throw new Error("Unknown staff member");
    await spendToken(tx, token);

    const [{ today }] = await tx`
      select count(*)::int as today from reviews where staff_id = ${input.staffId} and created_at = current_date`;
    const held = today >= BURST_LIMIT_PER_DAY;

    const [row] = await tx`
      insert into reviews (staff_id, course_code, semester, overall, clarity, fairness, availability, respect,
                           would_take_again, tags, body, is_alumni, hidden_reason)
      values (${input.staffId}, ${input.courseCode?.toUpperCase().replace(/\s/g, " ") ?? null}, ${input.semester},
              ${input.overall}, ${input.clarity ?? null}, ${input.fairness ?? null}, ${input.availability ?? null},
              ${input.respect ?? null}, ${input.wouldTakeAgain ?? null}, ${input.tags}, ${input.body},
              ${input.isAlumni}, ${held ? "burst_hold" : null})
      returning id`;
    if (held) {
      await tx`insert into moderation_queue (item_type, item_id, reason) values ('review', ${row.id}, 'burst_hold')`;
    }
    return { status: held ? "held" : "published", id: row.id };
  }) as Promise<SubmitResult>;
}
