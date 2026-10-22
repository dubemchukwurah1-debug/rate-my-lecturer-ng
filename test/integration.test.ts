// Runs against a real Postgres with the migrations applied (scripts/test-db.sh).
// Skipped when DATABASE_URL is not set.
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fromBase64, KEY_ALGORITHM, suite, toBase64, type Token } from "@/lib/token-suite";

const url = process.env.DATABASE_URL;

describe.skipIf(!url)("against the database", () => {
  let sql: postgres.Sql;
  let userId: string;
  let staffId: string;
  let lib: {
    tokens: typeof import("@/lib/tokens");
    reviews: typeof import("@/lib/reviews");
    facilities: typeof import("@/lib/facilities");
    staff: typeof import("@/lib/staff");
    moderation: typeof import("@/lib/moderation");
    verification: typeof import("@/lib/verification");
  };
  const photos = new Map<string, Blob>();
  const store = {
    put: async (path: string, file: Blob) => void photos.set(path, file),
    remove: async (paths: string[]) => void paths.forEach((p) => photos.delete(p)),
    signedUrl: async (path: string) => `memory://${path}`,
  };
  const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
  const newUser = async () => {
    const id = randomUUID();
    await sql`insert into auth.users (id) values (${id})`;
    return id;
  };

  async function mintTokens(n: number): Promise<Token[]> {
    const publicKey = await crypto.subtle.importKey("spki", fromBase64(process.env.TOKEN_PUBLIC_KEY!), KEY_ALGORITHM, true, ["verify"]);
    const s = suite();
    const pending = await Promise.all(
      Array.from({ length: n }, async () => {
        const msg = s.prepare(crypto.getRandomValues(new Uint8Array(32)));
        return { msg, ...(await s.blind(publicKey, msg)) };
      }),
    );
    const sigs = await lib.tokens.issueTokens(sql, userId, pending.map((p) => toBase64(p.blindedMsg)));
    return Promise.all(
      pending.map(async (p, i) => ({ msg: toBase64(p.msg), sig: toBase64(await s.finalize(publicKey, p.msg, fromBase64(sigs[i]), p.inv)) })),
    );
  }

  const body = "Explains every topic with real examples and marks fairly. Always shares the course outline early.";

  beforeAll(async () => {
    const { privateKey, publicKey } = await suite().generateKey({ modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) });
    process.env.TOKEN_PRIVATE_KEY = toBase64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey)));
    process.env.TOKEN_PUBLIC_KEY = toBase64(new Uint8Array(await crypto.subtle.exportKey("spki", publicKey)));
    process.env.UPVOTE_SECRET = "test-secret";
    lib = {
      tokens: await import("@/lib/tokens"),
      reviews: await import("@/lib/reviews"),
      facilities: await import("@/lib/facilities"),
      staff: await import("@/lib/staff"),
      moderation: await import("@/lib/moderation"),
      verification: await import("@/lib/verification"),
    };
    process.env.ID_HASH_SECRET = "test-id-secret";

    sql = postgres(url!, { prepare: false, onnotice: () => {} });
    userId = randomUUID();
    await sql`insert into auth.users (id) values (${userId})`;
    const [inst] = await sql`select id from institutions where slug = 'university-of-lagos'`;
    await sql`insert into student_accounts (user_id, institution_id, phone_verified_at, verified_via, verified_at)
              values (${userId}, ${inst.id}, now(), 'school_email', now())`;
    const [staff] = await sql`insert into staff (institution_id, full_name, role, status)
                              values (${inst.id}, 'Test Lecturer', 'lecturer', 'approved') returning id`;
    staffId = staff.id;
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("issues tokens up to the period cap and no further", async () => {
    const otherUser = randomUUID();
    await sql`insert into auth.users (id) values (${otherUser})`;
    // Any value below the modulus can be blind-signed; a leading zero byte guarantees that.
    const blinded = Array.from({ length: 5 }, () => {
      const b = crypto.getRandomValues(new Uint8Array(256));
      b[0] = 0;
      return toBase64(b);
    });
    for (let i = 0; i < 3; i++) await lib.tokens.issueTokens(sql, otherUser, blinded);
    await expect(lib.tokens.issueTokens(sql, otherUser, blinded.slice(0, 1))).rejects.toMatchObject({ status: 429 });
    await expect(lib.tokens.issueTokens(sql, otherUser, [])).rejects.toMatchObject({ status: 400 });
  });

  it("publishes a review with a valid token and stores nothing about the account", async () => {
    const [token] = await mintTokens(1);
    const result = await lib.reviews.submitReview(sql, lib.reviews.reviewSchema.parse({ staffId, semester: "2025/2026 first", overall: 4, body }), token);
    expect(result.status).toBe("published");
    const columns = await sql`select column_name from information_schema.columns where table_name = 'reviews'`;
    expect(columns.map((c) => c.column_name)).not.toContain("user_id");
  });

  it("rejects a reused or forged token", async () => {
    const [token] = await mintTokens(1);
    const input = lib.reviews.reviewSchema.parse({ staffId, semester: "2025/2026 first", overall: 3, body });
    await lib.reviews.submitReview(sql, input, token);
    await expect(lib.reviews.submitReview(sql, input, token)).rejects.toMatchObject({ status: 409 });
    await expect(lib.reviews.submitReview(sql, input, { msg: token.msg, sig: toBase64(new Uint8Array(256)) })).rejects.toMatchObject({ status: 403 });
  });

  it("does not burn a token when the content is rejected", async () => {
    const [token] = await mintTokens(1);
    const bad = lib.reviews.reviewSchema.parse({ staffId, semester: "2025/2026 first", overall: 1, body: `${body} He demands money for marks.` });
    expect(await lib.reviews.submitReview(sql, bad, token)).toMatchObject({ status: "rejected", redirectToReport: true });
    const ok = await lib.reviews.submitReview(sql, { ...bad, body }, token);
    expect(ok.status).toBe("published");
  });

  it("holds reviews beyond the daily burst limit for moderation", async () => {
    await sql`delete from reviews where staff_id = ${staffId}`;
    const tokens = await mintTokens(5);
    const statuses = [];
    for (let i = 0; i < 5; i++) {
      const extra = i === 4 ? await mintTokens(1) : [];
      const input = lib.reviews.reviewSchema.parse({ staffId, semester: "2025/2026 first", overall: 5, body });
      statuses.push((await lib.reviews.submitReview(sql, input, tokens[i])).status);
      if (extra.length) statuses.push((await lib.reviews.submitReview(sql, input, extra[0])).status);
    }
    expect(statuses.slice(0, 5)).toEqual(["published", "published", "published", "published", "published"]);
    expect(statuses[5]).toBe("held");
    const [queued] = await sql`select count(*)::int as n from moderation_queue where reason = 'burst_hold'`;
    expect(queued.n).toBeGreaterThan(0);
  });

  it("posts facility issues and counts one upvote per account", async () => {
    const [token] = await mintTokens(1);
    const result = await lib.facilities.postFacilityIssue(
      sql,
      lib.facilities.facilitySchema.parse({
        institutionSlug: "university-of-lagos",
        category: "Water and power",
        title: "No water in Jaja hall for two weeks",
        description: "The taps on every floor have been dry since the start of the semester.",
      }),
      token,
    );
    expect(result.status).toBe("posted");
    const id = (result as { id: string }).id;
    expect(await lib.facilities.upvoteFacilityIssue(sql, id, userId)).toBe(true);
    expect(await lib.facilities.upvoteFacilityIssue(sql, id, userId)).toBe(false);
    const [row] = await sql`select upvotes from facility_issues where id = ${id}`;
    expect(row.upvotes).toBe(1);
  });

  it("creates proposed staff as pending and queues them for moderation", async () => {
    const id = await lib.staff.proposeStaff(
      sql,
      lib.staff.staffProposalSchema.parse({ institutionSlug: "university-of-lagos", fullName: "Adaeze Okafor", role: "lecturer", department: "Computer Science" }),
    );
    const [row] = await sql`select status from staff where id = ${id}`;
    expect(row.status).toBe("pending");
    const [queued] = await sql`select reason from moderation_queue where item_id = ${id}`;
    expect(queued.reason).toBe("new_profile");
  });

  it("publishes a proposed profile once a moderator approves it", async () => {
    const id = await lib.staff.proposeStaff(
      sql,
      lib.staff.staffProposalSchema.parse({ institutionSlug: "university-of-lagos", fullName: "Musa Ibrahim Bello", role: "administrative" }),
    );
    const queue = await lib.moderation.openQueue(sql);
    const entry = queue.find((q) => q.itemId === id)!;
    expect(entry.summary).toContain("Musa Ibrahim Bello");
    await lib.moderation.resolveItem(sql, entry.id, true, store);
    const [row] = await sql`select status from staff where id = ${id}`;
    expect(row.status).toBe("approved");
    expect((await lib.moderation.openQueue(sql)).some((q) => q.id === entry.id)).toBe(false);
  });

  it("verifies school emails once a moderator confirms the domain", async () => {
    const user = await newUser();
    expect(await lib.verification.verifyBySchoolEmail(sql, user, "ada@cs.student.unn.edu.ng")).toBeNull();
    await lib.verification.suggestDomain(
      sql,
      lib.verification.domainSuggestionSchema.parse({ institutionSlug: "university-of-nigeria-nsukka", domain: "@Student.UNN.edu.ng" }),
    );
    const entry = (await lib.moderation.openQueue(sql)).find((q) => q.itemType === "domain" && q.summary === "student.unn.edu.ng")!;
    await lib.moderation.resolveItem(sql, entry.id, true, store);
    expect(await lib.verification.verifyBySchoolEmail(sql, user, "ada@cs.student.unn.edu.ng")).toBe("University of Nigeria, Nsukka");
    expect(await lib.verification.verifyBySchoolEmail(sql, await newUser(), "ada@gmail.com")).toBeNull();
  });

  it("verifies by ID card, deletes the photos, and flags a reused card", async () => {
    const first = await newUser();
    const input = { institutionSlug: "university-of-ibadan", idNumber: "UI/2023/0451", idCard: jpeg(), selfie: jpeg() };
    await lib.verification.submitIdVerification(sql, store, first, input);
    expect(photos.size).toBe(2);
    await expect(lib.verification.submitIdVerification(sql, store, first, input)).rejects.toThrow(/already waiting/);

    const entry = (await lib.moderation.openQueue(sql)).find((q) => q.itemType === "verification")!;
    expect(entry.reason).toBe("id_check");
    await lib.moderation.resolveItem(sql, entry.id, true, store);
    expect(photos.size).toBe(0);
    const [account] = await sql`select verified_via, verified_at from student_accounts where user_id = ${first}`;
    expect(account.verified_via).toBe("id_selfie");
    expect(account.verified_at).not.toBeNull();

    // Same card, written differently, on a second account.
    const second = await newUser();
    await lib.verification.submitIdVerification(sql, store, second, { ...input, idNumber: "ui 2023 0451", idCard: jpeg(), selfie: jpeg() });
    const dup = (await lib.moderation.openQueue(sql)).find((q) => q.itemType === "verification")!;
    expect(dup.reason).toBe("duplicate_id");
    await lib.moderation.resolveItem(sql, dup.id, false, store);
    const [rejected] = await sql`select verified_at from student_accounts where user_id = ${second}`;
    expect(rejected.verified_at).toBeNull();
    expect(photos.size).toBe(0);
  });

  it("refuses non-image uploads", async () => {
    const user = await newUser();
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    await expect(
      lib.verification.submitIdVerification(sql, store, user, { institutionSlug: "university-of-ibadan", idNumber: "1234", idCard: pdf, selfie: jpeg() }),
    ).rejects.toThrow(/JPEG/);
  });

  it("purges ID checks older than 7 days", async () => {
    const user = await newUser();
    await lib.verification.submitIdVerification(sql, store, user, {
      institutionSlug: "university-of-ibadan",
      idNumber: "EXPIRE-1",
      idCard: jpeg(),
      selfie: jpeg(),
    });
    await sql`update verification_requests set delete_after = now() - interval '1 minute' where user_id = ${user}`;
    expect(await lib.verification.purgeExpiredVerifications(sql, store)).toBe(1);
    expect(photos.size).toBe(0);
    const [left] = await sql`select count(*)::int as n from verification_requests where user_id = ${user}`;
    expect(left.n).toBe(0);
  });
});
