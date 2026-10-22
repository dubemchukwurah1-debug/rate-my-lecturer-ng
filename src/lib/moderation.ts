import "server-only";
import type postgres from "postgres";
import { publishYellow } from "./flags";
import type { PhotoStore } from "./verification-storage";

export interface QueueItem {
  id: string;
  itemType: "review" | "facility_issue" | "staff" | "verification" | "domain" | "flag" | "staff_claim" | "takedown";
  itemId: string;
  reason: string;
  createdAt: Date;
  summary: string;
  institution: string;
}

export async function openQueue(sql: postgres.Sql): Promise<QueueItem[]> {
  return sql<QueueItem[]>`
    select q.id, q.item_type as "itemType", q.item_id as "itemId", q.reason, q.created_at as "createdAt",
           coalesce(
             case q.item_type
               when 'staff' then (select concat_ws(' ', s.title, s.full_name, '(' || s.role || ')') from staff s where s.id = q.item_id)
               when 'review' then (select concat(r.overall, '★ ', r.body) from reviews r where r.id = q.item_id)
               when 'facility_issue' then (select f.title from facility_issues f where f.id = q.item_id)
               when 'verification' then (select 'ID card and selfie check' from verification_requests v where v.id = q.item_id)
               when 'domain' then (select d.domain from domain_suggestions d where d.id = q.item_id)
               when 'flag' then (select concat(initcap(r.colour::text), ' report about ', s.full_name, ': ', r.category)
                                 from flag_reports r join staff s on s.id = r.staff_id where r.id = q.item_id)
               when 'staff_claim' then (select concat(s.full_name, ' claim. Evidence: ', c.evidence)
                                        from staff_claims c join staff s on s.id = c.staff_id where c.id = q.item_id)
               when 'takedown' then (select concat('Takedown request about a ', replace(t.target_type, '_', ' '), ': ', t.reason)
                                     from takedown_requests t where t.id = q.item_id)
             end, '(deleted)') as summary,
           coalesce(
             case q.item_type
               when 'staff' then (select i.name from staff s join institutions i on i.id = s.institution_id where s.id = q.item_id)
               when 'review' then (select i.name from reviews r join staff s on s.id = r.staff_id
                                   join institutions i on i.id = s.institution_id where r.id = q.item_id)
               when 'facility_issue' then (select i.name from facility_issues f join institutions i on i.id = f.institution_id
                                           where f.id = q.item_id)
               when 'verification' then (select i.name from verification_requests v join institutions i on i.id = v.institution_id
                                         where v.id = q.item_id)
               when 'domain' then (select i.name from domain_suggestions d join institutions i on i.id = d.institution_id
                                   where d.id = q.item_id)
               when 'flag' then (select i.name from flag_reports r join staff s on s.id = r.staff_id
                                 join institutions i on i.id = s.institution_id where r.id = q.item_id)
               when 'staff_claim' then (select i.name from staff_claims c join staff s on s.id = c.staff_id
                                        join institutions i on i.id = s.institution_id where c.id = q.item_id)
             end, '') as institution
    from moderation_queue q
    where q.resolved_at is null
    order by q.created_at`;
}

export async function verificationPhotos(sql: postgres.Sql, store: PhotoStore, requestId: string) {
  const [req] = await sql`select id_card_path, selfie_path from verification_requests where id = ${requestId}`;
  if (!req) return null;
  const [idCard, selfie] = await Promise.all([store.signedUrl(req.id_card_path), store.signedUrl(req.selfie_path)]);
  return { idCard, selfie };
}

// Approving publishes the item; rejecting removes it (staff) or keeps it hidden
// (reviews). For ID checks both outcomes delete the photos and the request.
export async function resolveItem(sql: postgres.Sql, queueId: string, approve: boolean, store: PhotoStore): Promise<void> {
  const photosToDelete: string[] = [];
  await sql.begin(async (tx) => {
    const [item] = await tx`
      update moderation_queue set resolved_at = now() where id = ${queueId} and resolved_at is null
      returning item_type, item_id, reason`;
    if (!item) return;
    if (item.item_type === "staff") {
      await tx`update staff set status = ${approve ? "approved" : "rejected"} where id = ${item.item_id}`;
    } else if (item.item_type === "review") {
      await tx`update reviews set hidden_reason = ${approve ? null : "moderator_removed"} where id = ${item.item_id}`;
    } else if (item.item_type === "verification") {
      const [req] = await tx`
        delete from verification_requests where id = ${item.item_id}
        returning user_id, institution_id, id_card_path, selfie_path, id_number_hash`;
      if (!req) return;
      photosToDelete.push(req.id_card_path, req.selfie_path);
      if (approve) {
        await tx`
          update student_accounts set institution_id = ${req.institution_id}, verified_via = 'id_selfie', verified_at = now()
          where user_id = ${req.user_id}`;
        await tx`insert into used_id_cards (id_number_hash) values (${req.id_number_hash}) on conflict do nothing`;
      }
    } else if (item.item_type === "domain") {
      const [suggestion] = await tx`delete from domain_suggestions where id = ${item.item_id} returning institution_id, domain`;
      if (suggestion && approve) {
        await tx`
          update institutions set student_email_domains = array_append(student_email_domains, ${suggestion.domain})
          where id = ${suggestion.institution_id} and not (${suggestion.domain} = any(student_email_domains))`;
      }
    } else if (item.item_type === "flag") {
      // Red reports are decided in the panel, where every decision records its reasons.
      if (item.reason === "red_report") throw new Error("Red reports are decided in the review panel");
      const [report] = await tx`select staff_id from flag_reports where id = ${item.item_id}`;
      if (report && approve) await publishYellow(tx, report.staff_id);
    } else if (item.item_type === "takedown") {
      throw new Error("Takedown requests are decided in the review panel");
    } else if (item.item_type === "staff_claim") {
      const [claim] = await tx`delete from staff_claims where id = ${item.item_id} returning staff_id, user_id`;
      if (claim && approve) await tx`update staff set claimed_by = ${claim.user_id} where id = ${claim.staff_id} and claimed_by is null`;
    } else if (!approve) {
      await tx`delete from facility_issues where id = ${item.item_id}`;
    }
  });
  if (photosToDelete.length > 0) await store.remove(photosToDelete);
}
