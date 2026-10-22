// Takedown and appeal requests, against a real Postgres (scripts/test-db.sh).
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.DATABASE_URL;

describe.skipIf(!url)("takedown requests", () => {
  let sql: postgres.Sql;
  let lib: typeof import("@/lib/takedown");
  let moderation: typeof import("@/lib/moderation");
  let modId: string;
  let staffId: string;
  let instId: string;
  const store = { put: async () => {}, remove: async () => {}, signedUrl: async () => "" };
  const reason = "This flag is false: the matter was investigated and closed by the school last year.";

  const publishedFlag = async () =>
    (await sql`insert into published_flags (staff_id, colour, public_text, published_at)
               values (${staffId}, 'green', 'Commended by students', now())
               on conflict (staff_id, colour) do update set published_at = now() returning id`)[0].id as string;

  beforeAll(async () => {
    lib = await import("@/lib/takedown");
    moderation = await import("@/lib/moderation");
    sql = postgres(url!, { prepare: false, onnotice: () => {} });
    modId = randomUUID();
    await sql`insert into auth.users (id) values (${modId})`;
    instId = (await sql`select id from institutions where slug = 'university-of-lagos'`)[0].id;
    staffId = (await sql`insert into staff (institution_id, full_name, role, status)
                         values (${instId}, 'Takedown Lecturer', 'lecturer', 'approved') returning id`)[0].id;
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("only accepts requests about public content", async () => {
    await expect(
      lib.submitTakedown(sql, { targetType: "flag", targetId: randomUUID(), requesterRole: "staff", reason }),
    ).rejects.toThrow("not on the site");
  });

  it("queues a request, keeps it out of the general queue, and removes a flag on decision", async () => {
    const flagId = await publishedFlag();
    const id = await lib.submitTakedown(sql, {
      targetType: "flag", targetId: flagId, requesterRole: "staff", contactEmail: "lecturer@unilag.edu.ng", reason,
    });
    const [open] = (await lib.openTakedowns(sql)).filter((t) => t.id === id);
    expect(open).toMatchObject({ staffId, contactEmail: "lecturer@unilag.edu.ng" });
    expect(open.content).toContain("Green flag on Takedown Lecturer");
    expect(open.dueBy.getTime() - Date.now()).toBeGreaterThan(47 * 3_600_000);

    const [q] = await sql`select id from moderation_queue where item_id = ${id}`;
    await expect(moderation.resolveItem(sql, q.id, true, store)).rejects.toThrow("review panel");

    await expect(lib.decideTakedown(sql, id, modId, true, "short")).rejects.toThrow("reasons");
    await lib.decideTakedown(sql, id, modId, true, "School record shows the matter closed.");
    const [flag] = await sql`select published_at from published_flags where id = ${flagId}`;
    expect(flag.published_at).toBeNull();
    const [queued] = await sql`select resolved_at from moderation_queue where item_id = ${id}`;
    expect(queued.resolved_at).not.toBeNull();
    await expect(lib.decideTakedown(sql, id, modId, false, "Second decision attempt.")).rejects.toThrow("already decided");
  });

  it("keeps content when the request is refused, and erases contacts after 90 days", async () => {
    const [issue] = await sql`insert into facility_issues (institution_id, category, title, description)
                              values (${instId}, 'Water', 'No water in hostel', 'Taps dry for two weeks.') returning id`;
    const id = await lib.submitTakedown(sql, {
      targetType: "facility_issue", targetId: issue.id, requesterRole: "other", contactEmail: "works@unilag.edu.ng", reason,
    });
    await lib.decideTakedown(sql, id, modId, false, "Post describes a real, current problem.");
    expect(await sql`select 1 from facility_issues where id = ${issue.id}`).toHaveLength(1);

    expect(await lib.purgeTakedownContacts(sql)).toBe(0);
    await sql`update takedown_requests set decided_at = now() - interval '91 days' where id = ${id}`;
    expect(await lib.purgeTakedownContacts(sql)).toBeGreaterThanOrEqual(1);
    const [row] = await sql`select contact_email, decision from takedown_requests where id = ${id}`;
    expect(row).toMatchObject({ contact_email: null, decision: "kept" });
  });
});
