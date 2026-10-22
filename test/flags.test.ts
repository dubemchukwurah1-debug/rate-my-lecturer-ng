// Flag reports, the review panel and right of reply, against a real Postgres
// (scripts/test-db.sh). Skipped when DATABASE_URL is not set.
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fromBase64, KEY_ALGORITHM, suite, toBase64, type Token } from "@/lib/token-suite";

const url = process.env.DATABASE_URL;

describe("crypto box", () => {
  it("round-trips and rejects tampering", async () => {
    process.env.REPORT_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const { encrypt, decrypt } = await import("@/lib/crypto-box");
    const box = encrypt("private details");
    expect(decrypt(box)).toBe("private details");
    box[box.length - 1] ^= 1;
    expect(() => decrypt(box)).toThrow();
  });
});

describe("yellow points", () => {
  it("halve each year and expire after two", async () => {
    const { yellowPoints } = await import("@/lib/flags");
    const now = new Date("2026-10-22");
    const yearsAgo = (y: number) => new Date(now.getTime() - y * 365.25 * 86_400_000);
    expect(yellowPoints([now, now], now)).toBe(6);
    expect(yellowPoints([yearsAgo(1)], now)).toBeCloseTo(1.5);
    expect(yellowPoints([yearsAgo(2.1)], now)).toBe(0);
  });
});

describe.skipIf(!url)("flags against the database", () => {
  let sql: postgres.Sql;
  let userId: string;
  let instId: string;
  let flags: typeof import("@/lib/flags");
  let tokens: typeof import("@/lib/tokens");
  let portal: typeof import("@/lib/staff-portal");
  let moderation: typeof import("@/lib/moderation");
  const store = { put: async () => {}, remove: async () => {}, signedUrl: async () => "" };
  const wallet: Token[] = [];

  async function mint(n: number) {
    const publicKey = await crypto.subtle.importKey("spki", fromBase64(process.env.TOKEN_PUBLIC_KEY!), KEY_ALGORITHM, true, ["verify"]);
    const s = suite();
    const pending = await Promise.all(
      Array.from({ length: n }, async () => {
        const msg = s.prepare(crypto.getRandomValues(new Uint8Array(32)));
        return { msg, ...(await s.blind(publicKey, msg)) };
      }),
    );
    const sigs = await tokens.issueTokens(sql, userId, pending.map((p) => toBase64(p.blindedMsg)));
    for (const [i, p] of pending.entries()) {
      wallet.push({ msg: toBase64(p.msg), sig: toBase64(await s.finalize(publicKey, p.msg, fromBase64(sigs[i]), p.inv)) });
    }
  }

  const newStaff = async (name: string) =>
    (await sql`insert into staff (institution_id, full_name, role, status) values (${instId}, ${name}, 'lecturer', 'approved') returning id`)[0]
      .id as string;
  const details = "Detailed account of what happened during the course, with dates and the lecture hall.";
  const file = (staffId: string, colour: "green" | "yellow" | "red", category: string, extra = {}) =>
    flags.fileReport(sql, { staffId, colour, category, details, referralConsent: false, ...extra }, wallet.pop()!);

  beforeAll(async () => {
    const { privateKey, publicKey } = await suite().generateKey({ modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) });
    process.env.TOKEN_PRIVATE_KEY = toBase64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey)));
    process.env.TOKEN_PUBLIC_KEY = toBase64(new Uint8Array(await crypto.subtle.exportKey("spki", publicKey)));
    process.env.REPORT_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    flags = await import("@/lib/flags");
    tokens = await import("@/lib/tokens");
    portal = await import("@/lib/staff-portal");
    moderation = await import("@/lib/moderation");

    sql = postgres(url!, { prepare: false, onnotice: () => {} });
    userId = randomUUID();
    await sql`insert into auth.users (id) values (${userId})`;
    instId = (await sql`select id from institutions where slug = 'university-of-ibadan'`)[0].id;
    await sql`insert into student_accounts (user_id, institution_id, verified_via, verified_at)
              values (${userId}, ${instId}, 'school_email', now())`;
    await mint(5);
    await mint(5);
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("publishes a green flag after three commendations", async () => {
    const staffId = await newStaff("Green Lecturer");
    await file(staffId, "green", "Supportive and approachable");
    await file(staffId, "green", "Supportive and approachable");
    expect(await flags.publicFlags(sql, staffId)).toEqual([]);
    await file(staffId, "green", "Fair and transparent grading");
    const shown = await flags.publicFlags(sql, staffId);
    expect(shown).toMatchObject([{ colour: "green", reportCount: 3 }]);
  });

  it("rejects personal data in reports that can become public", async () => {
    const staffId = await newStaff("Checked Lecturer");
    const before = wallet.length;
    const res = await flags.fileReport(
      sql,
      { staffId, colour: "yellow", category: "Demeaning remarks", details: `${details} Call him on 08031234567.`, referralConsent: false },
      wallet[wallet.length - 1],
    );
    expect(res).toMatchObject({ status: "rejected", issues: ["phone_number"] });
    expect(wallet.length).toBe(before); // the token stays in the wallet and is spent by a later test
  });

  it("sends yellow reports to moderators at the threshold, then publishes on approval", async () => {
    const staffId = await newStaff("Yellow Lecturer");
    for (let i = 0; i < 4; i++) await file(staffId, "yellow", "Persistent absence or lateness");
    const [item] = await sql`
      select q.id from moderation_queue q join flag_reports r on r.id = q.item_id
      where r.staff_id = ${staffId} and q.reason = 'yellow_threshold' and q.resolved_at is null`;
    expect(item).toBeDefined();
    expect(await flags.publicFlags(sql, staffId)).toEqual([]);
    await moderation.resolveItem(sql, item.id, true, store);
    const [shown] = await flags.publicFlags(sql, staffId);
    expect(shown).toMatchObject({ colour: "yellow", reportCount: 4 });
    expect(shown.text).toContain("persistent absence or lateness");
  });

  it("keeps red reports private until the panel acts and the reply window ends", async () => {
    const staffId = await newStaff("Red Lecturer");
    const modId = randomUUID();
    await sql`insert into auth.users (id) values (${modId})`;
    const first = await file(staffId, "red", "Demanding money for marks");
    if (first.status !== "filed") throw new Error("not filed");
    expect(await flags.caseStatus(sql, first.caseNumber, first.caseKey)).toContain("Received");
    expect(await flags.caseStatus(sql, first.caseNumber, "wrong-key")).toBeNull();

    // Red items cannot be waved through the general queue.
    const [q] = await sql`select q.id from moderation_queue q join flag_reports r on r.id = q.item_id where r.case_number = ${first.caseNumber}`;
    await expect(moderation.resolveItem(sql, q.id, true, store)).rejects.toThrow("review panel");

    const cases = await flags.openRedCases(sql);
    const group = cases.find((c) => c.staffId === staffId)!;
    expect(group.cases[0].details.details).toBe(details);

    await expect(flags.decideCase(sql, group.cases[0].id, modId, "kept_on_file", "short")).rejects.toThrow("reasons");
    await flags.decideCase(sql, group.cases[0].id, modId, "kept_on_file", "Specific, consistent account with dates.");
    await expect(flags.proposeRedFlag(sql, staffId, modId, "Pattern of credible reports.")).rejects.toThrow("credible");

    const second = await file(staffId, "red", "Demanding money for marks");
    if (second.status !== "filed") throw new Error("not filed");
    const secondId = (await sql`select id from flag_reports where case_number = ${second.caseNumber}`)[0].id;
    await flags.decideCase(sql, secondId, modId, "kept_on_file", "Independent account matching the first.");
    expect(await flags.openCaseDeadline(sql, staffId)).toBeNull();
    await flags.proposeRedFlag(sql, staffId, modId, "Pattern of credible reports.");
    expect(await flags.openCaseDeadline(sql, staffId)).toBeInstanceOf(Date);
    const [logged] = await sql`select reasons from case_decisions where report_id = ${secondId} and decision = 'awaiting_reply'`;
    expect(logged.reasons).toContain("profile page notice");
    expect(await flags.caseStatus(sql, second.caseNumber, second.caseKey)).toContain("7 days");
    expect(await flags.publicFlags(sql, staffId)).toEqual([]);

    // The staff member claims the profile and responds before publication.
    const staffUser = randomUUID();
    await sql`insert into auth.users (id) values (${staffUser})`;
    await portal.claimProfile(sql, staffUser, { staffId, evidence: "Staff ID card and official university email." });
    const [claim] = await sql`select q.id from moderation_queue q join staff_claims c on c.id = q.item_id where c.staff_id = ${staffId}`;
    await moderation.resolveItem(sql, claim.id, true, store);
    expect(await portal.claimedStaffIds(sql, staffUser)).toEqual([staffId]);
    await expect(portal.respondToFlag(sql, userId, staffId, "Not my profile but trying anyway.")).rejects.toThrow();
    await portal.respondToFlag(sql, staffUser, staffId, "I deny these claims and have asked the school to investigate.");

    await expect(flags.publishRedFlag(sql, staffId, modId, "Reply window ended.")).rejects.toThrow("7-day");
    const later = new Date(Date.now() + 8 * 86_400_000);
    await flags.publishRedFlag(sql, staffId, modId, "Reply window ended, response attached.", later);
    const [shown] = await flags.publicFlags(sql, staffId);
    expect(shown).toMatchObject({ colour: "red", reportCount: 2, text: flags.RED_PUBLIC_TEXT });
    expect(shown.response).toContain("I deny");
    expect(await flags.openCaseDeadline(sql, staffId)).toBeNull();

    const [{ n }] = await sql`
      select count(*)::int as n from case_decisions d join flag_reports r on r.id = d.report_id where r.staff_id = ${staffId}`;
    expect(n).toBe(6); // 2 kept_on_file, 2 awaiting_reply, 2 published
  });

  it("lets a claimed staff member reply only to their own reviews", async () => {
    const [review] = await sql`select r.id, r.staff_id from reviews r limit 1`;
    if (!review) return; // reviews come from the other suite when both run on one database
    await expect(portal.replyToReview(sql, userId, review.id, "A reply from someone who is not the lecturer.")).rejects.toThrow();
  });
});
