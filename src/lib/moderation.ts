import "server-only";
import type postgres from "postgres";

export interface QueueItem {
  id: string;
  itemType: "review" | "facility_issue" | "staff";
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
             end, '(deleted)') as summary,
           coalesce(
             case q.item_type
               when 'staff' then (select i.name from staff s join institutions i on i.id = s.institution_id where s.id = q.item_id)
               when 'review' then (select i.name from reviews r join staff s on s.id = r.staff_id
                                   join institutions i on i.id = s.institution_id where r.id = q.item_id)
               when 'facility_issue' then (select i.name from facility_issues f join institutions i on i.id = f.institution_id
                                           where f.id = q.item_id)
             end, '') as institution
    from moderation_queue q
    where q.resolved_at is null
    order by q.created_at`;
}

// Approving publishes the item; rejecting removes it (staff) or keeps it hidden (reviews).
export async function resolveItem(sql: postgres.Sql, queueId: string, approve: boolean): Promise<void> {
  await sql.begin(async (tx) => {
    const [item] = await tx`
      update moderation_queue set resolved_at = now() where id = ${queueId} and resolved_at is null
      returning item_type, item_id`;
    if (!item) return;
    if (item.item_type === "staff") {
      await tx`update staff set status = ${approve ? "approved" : "rejected"} where id = ${item.item_id}`;
    } else if (item.item_type === "review") {
      await tx`update reviews set hidden_reason = ${approve ? null : "moderator_removed"} where id = ${item.item_id}`;
    } else if (!approve) {
      await tx`delete from facility_issues where id = ${item.item_id}`;
    }
  });
}
