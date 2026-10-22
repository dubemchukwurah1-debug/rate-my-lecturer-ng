import "server-only";
import { z } from "zod";
import type postgres from "postgres";

export const staffProposalSchema = z.object({
  institutionSlug: z.string().min(1),
  fullName: z.string().trim().min(5).max(120),
  title: z.string().trim().max(40).optional(),
  role: z.enum(["lecturer", "administrative"]),
  department: z.string().trim().min(2).max(120).optional(),
  courseCodes: z.array(z.string().trim().max(12)).max(10).default([]),
});

export type StaffProposal = z.infer<typeof staffProposalSchema>;

// Students propose staff; a moderator approves before the profile is public.
// The proposer is not recorded.
export async function proposeStaff(sql: postgres.Sql, input: StaffProposal): Promise<string> {
  return sql.begin(async (tx) => {
    const [inst] = await tx`select id from institutions where slug = ${input.institutionSlug}`;
    if (!inst) throw new Error("Unknown institution");
    let departmentId: string | null = null;
    if (input.department) {
      const [dept] = await tx`
        insert into departments (institution_id, name) values (${inst.id}, ${input.department})
        on conflict (institution_id, name) do update set name = excluded.name
        returning id`;
      departmentId = dept.id;
    }
    const [row] = await tx`
      insert into staff (institution_id, department_id, full_name, title, role, proposed_course_codes)
      values (${inst.id}, ${departmentId}, ${input.fullName}, ${input.title ?? null}, ${input.role}, ${input.courseCodes})
      returning id`;
    await tx`insert into moderation_queue (item_type, item_id, reason) values ('staff', ${row.id}, 'new_profile')`;
    return row.id as string;
  });
}
