import "server-only";
import { z } from "zod";
import type postgres from "postgres";

export const RESPONSE_HOURS = 48;
const CONTACT_RETENTION_DAYS = 90;

export const takedownSchema = z.object({
  targetType: z.enum(["flag", "review", "facility_issue"]),
  targetId: z.guid(),
  requesterRole: z.enum(["staff", "representative", "student", "other"]),
  contactEmail: z.email().optional(),
  reason: z.string().trim().min(30).max(4000),
});

export type TakedownInput = z.infer<typeof takedownSchema>;

export class TakedownError extends Error {}

// Only content that is actually public can be the subject of a request.
async function targetIsPublic(tx: postgres.TransactionSql | postgres.Sql, type: TakedownInput["targetType"], id: string) {
  const [row] =
    type === "flag"
      ? await tx`select 1 from published_flags where id = ${id} and published_at is not null`
      : type === "review"
        ? await tx`select 1 from reviews where id = ${id} and hidden_reason is null`
        : await tx`select 1 from facility_issues where id = ${id}`;
  return Boolean(row);
}

export async function submitTakedown(sql: postgres.Sql, input: TakedownInput): Promise<string> {
  return sql.begin(async (tx) => {
    if (!(await targetIsPublic(tx, input.targetType, input.targetId))) throw new TakedownError("That content is not on the site");
    const [row] = await tx`
      insert into takedown_requests (target_type, target_id, requester_role, contact_email, reason)
      values (${input.targetType}, ${input.targetId}, ${input.requesterRole}, ${input.contactEmail ?? null}, ${input.reason})
      returning id`;
    await tx`insert into moderation_queue (item_type, item_id, reason) values ('takedown', ${row.id}, 'takedown_request')`;
    return row.id as string;
  });
}

export interface OpenTakedown {
  id: string;
  targetType: TakedownInput["targetType"];
  targetId: string;
  requesterRole: string;
  contactEmail: string | null;
  reason: string;
  dueBy: Date;
  content: string;
  staffId: string | null;
}

export async function openTakedowns(sql: postgres.Sql): Promise<OpenTakedown[]> {
  return sql<OpenTakedown[]>`
    select t.id, t.target_type as "targetType", t.target_id as "targetId", t.requester_role as "requesterRole",
           t.contact_email as "contactEmail", t.reason, t.created_at + make_interval(hours => ${RESPONSE_HOURS}) as "dueBy",
           coalesce(case t.target_type
             when 'flag' then (select concat(initcap(f.colour::text), ' flag on ', s.full_name, ': ', f.public_text)
                               from published_flags f join staff s on s.id = f.staff_id where f.id = t.target_id)
             when 'review' then (select concat(r.overall, '★ review of ', s.full_name, ': ', r.body)
                                 from reviews r join staff s on s.id = r.staff_id where r.id = t.target_id)
             when 'facility_issue' then (select concat('Facility post: ', f.title, '. ', f.description) from facility_issues f where f.id = t.target_id)
           end, '(already removed)') as content,
           case t.target_type
             when 'flag' then (select staff_id from published_flags where id = t.target_id)
             when 'review' then (select staff_id from reviews where id = t.target_id)
           end as "staffId"
    from takedown_requests t
    where t.decided_at is null
    order by t.created_at`;
}

export async function decideTakedown(sql: postgres.Sql, id: string, moderatorId: string, remove: boolean, reasons: string) {
  if (reasons.trim().length < 10) throw new TakedownError("Write down the reasons for this decision");
  await sql.begin(async (tx) => {
    const [t] = await tx`
      update takedown_requests set decision = ${remove ? "removed" : "kept"}, decision_reasons = ${reasons.trim()},
        decided_by = ${moderatorId}, decided_at = now()
      where id = ${id} and decided_at is null
      returning target_type, target_id`;
    if (!t) throw new TakedownError("Unknown or already decided request");
    if (remove) {
      if (t.target_type === "flag") await tx`update published_flags set published_at = null where id = ${t.target_id}`;
      else if (t.target_type === "review") await tx`update reviews set hidden_reason = 'takedown' where id = ${t.target_id}`;
      else await tx`delete from facility_issues where id = ${t.target_id}`;
    }
    await tx`update moderation_queue set resolved_at = now() where item_id = ${id} and resolved_at is null`;
  });
}

export async function purgeTakedownContacts(sql: postgres.Sql): Promise<number> {
  const rows = await sql`
    update takedown_requests set contact_email = null
    where contact_email is not null and decided_at < now() - make_interval(days => ${CONTACT_RETENTION_DAYS})
    returning id`;
  return rows.length;
}
