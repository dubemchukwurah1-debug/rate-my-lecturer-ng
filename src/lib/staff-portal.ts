import "server-only";
import { z } from "zod";
import type postgres from "postgres";

// Right of reply: a staff member claims their profile (checked by a moderator),
// then can answer reviews and respond to a red-flag case before publication.

export const claimSchema = z.object({
  staffId: z.guid(),
  evidence: z.string().trim().min(20).max(1000),
});

export async function claimProfile(sql: postgres.Sql, userId: string, input: z.infer<typeof claimSchema>) {
  await sql.begin(async (tx) => {
    const [staff] = await tx`select claimed_by from staff where id = ${input.staffId} and status in ('approved', 'left')`;
    if (!staff) throw new Error("Unknown staff member");
    if (staff.claimed_by) throw new Error("This profile has already been claimed");
    const [claim] = await tx`
      insert into staff_claims (staff_id, user_id, evidence) values (${input.staffId}, ${userId}, ${input.evidence})
      on conflict (staff_id, user_id) do nothing returning id`;
    if (claim) await tx`insert into moderation_queue (item_type, item_id, reason) values ('staff_claim', ${claim.id}, 'profile_claim')`;
  });
}

export async function claimedStaffIds(sql: postgres.Sql, userId: string): Promise<string[]> {
  return (await sql`select id from staff where claimed_by = ${userId}`).map((r) => r.id);
}

export const replySchema = z.object({ body: z.string().trim().min(20).max(1000) });

export async function replyToReview(sql: postgres.Sql, userId: string, reviewId: string, body: string): Promise<void> {
  const [ok] = await sql`
    select 1 from reviews r join staff s on s.id = r.staff_id where r.id = ${reviewId} and s.claimed_by = ${userId}`;
  if (!ok) throw new Error("You can only reply to reviews of your own profile");
  await sql`
    insert into review_replies (review_id, body) values (${reviewId}, ${body})
    on conflict (review_id) do update set body = excluded.body, created_at = now()`;
}

export async function respondToFlag(sql: postgres.Sql, userId: string, staffId: string, body: string): Promise<void> {
  const [ok] = await sql`select 1 from staff where id = ${staffId} and claimed_by = ${userId}`;
  if (!ok) throw new Error("You can only respond for your own profile");
  await sql`
    insert into flag_responses (staff_id, body) values (${staffId}, ${body})
    on conflict (staff_id) do update set body = excluded.body, updated_at = now()`;
}
