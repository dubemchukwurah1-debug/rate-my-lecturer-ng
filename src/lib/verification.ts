import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import type postgres from "postgres";
import { emailDomain, isPersonalEmailDomain } from "./email-domains";
import type { PhotoStore } from "./verification-storage";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function ensureAccount(sql: postgres.Sql, userId: string): Promise<void> {
  await sql`insert into student_accounts (user_id) values (${userId}) on conflict do nothing`;
}

// Verifies an account at once when its sign-in email is on a confirmed student
// domain. Returns the institution's name, or null when no domain matches.
export async function verifyBySchoolEmail(sql: postgres.Sql, userId: string, email: string): Promise<string | null> {
  const domain = emailDomain(email);
  if (!domain || isPersonalEmailDomain(domain)) return null;
  const [inst] = await sql`
    select i.id, i.name from institutions i, unnest(i.student_email_domains) d
    where ${domain} = d or ${domain} like '%.' || d
    limit 1`;
  if (!inst) return null;
  await ensureAccount(sql, userId);
  await sql`
    update student_accounts set institution_id = ${inst.id}, verified_via = 'school_email', verified_at = now()
    where user_id = ${userId}`;
  return inst.name;
}

export function hashIdNumber(idNumber: string): Buffer {
  const secret = process.env.ID_HASH_SECRET;
  if (!secret) throw new Error("ID_HASH_SECRET must be set");
  const normalised = idNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHmac("sha256", secret).update(normalised).digest();
}

export const idVerificationSchema = z.object({
  institutionSlug: z.string().min(1),
  idNumber: z.string().trim().min(4).max(40),
  idCard: z.instanceof(Blob),
  selfie: z.instanceof(Blob),
});

export class VerificationError extends Error {}

function checkPhoto(file: Blob, label: string) {
  if (!PHOTO_TYPES.includes(file.type)) throw new VerificationError(`${label} must be a JPEG, PNG or WebP photo`);
  if (file.size > MAX_PHOTO_BYTES) throw new VerificationError(`${label} must be under 5 MB`);
}

// Queues an ID-card + selfie check for a moderator. A card number already used by
// another account is flagged as a duplicate rather than refused, so a moderator
// can look at both.
export async function submitIdVerification(
  sql: postgres.Sql,
  store: PhotoStore,
  userId: string,
  input: z.infer<typeof idVerificationSchema>,
): Promise<void> {
  checkPhoto(input.idCard, "ID card");
  checkPhoto(input.selfie, "Selfie");
  const [inst] = await sql`select id from institutions where slug = ${input.institutionSlug}`;
  if (!inst) throw new VerificationError("Choose your institution");
  const [pending] = await sql`select 1 from verification_requests where user_id = ${userId}`;
  if (pending) throw new VerificationError("Your ID check is already waiting for a moderator");

  const hash = hashIdNumber(input.idNumber);
  const prefix = `${userId}/${randomUUID()}`;
  const idCardPath = `${prefix}/id-card`;
  const selfiePath = `${prefix}/selfie`;
  await store.put(idCardPath, input.idCard);
  await store.put(selfiePath, input.selfie);

  try {
    await sql.begin(async (tx) => {
      await tx`insert into student_accounts (user_id) values (${userId}) on conflict do nothing`;
      const [dup] = await tx`
        select 1 from used_id_cards where id_number_hash = ${hash}
        union all
        select 1 from verification_requests where id_number_hash = ${hash} and user_id <> ${userId}
        limit 1`;
      const [req] = await tx`
        insert into verification_requests (user_id, institution_id, id_card_path, selfie_path, id_number_hash)
        values (${userId}, ${inst.id}, ${idCardPath}, ${selfiePath}, ${hash})
        returning id`;
      await tx`
        insert into moderation_queue (item_type, item_id, reason)
        values ('verification', ${req.id}, ${dup ? "duplicate_id" : "id_check"})`;
    });
  } catch (err) {
    await store.remove([idCardPath, selfiePath]);
    throw err;
  }
}

export const domainSuggestionSchema = z.object({
  institutionSlug: z.string().min(1),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/^@/, ""))
    .pipe(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a domain like student.unilag.edu.ng")),
});

export async function suggestDomain(sql: postgres.Sql, input: z.infer<typeof domainSuggestionSchema>): Promise<void> {
  if (isPersonalEmailDomain(input.domain)) throw new VerificationError("Personal email domains can't be used");
  await sql.begin(async (tx) => {
    const [inst] = await tx`select id from institutions where slug = ${input.institutionSlug}`;
    if (!inst) throw new VerificationError("Choose your institution");
    const [row] = await tx`
      insert into domain_suggestions (institution_id, domain) values (${inst.id}, ${input.domain})
      on conflict do nothing returning id`;
    if (row) await tx`insert into moderation_queue (item_type, item_id, reason) values ('domain', ${row.id}, 'domain_suggestion')`;
  });
}

// Deletes ID checks past their 7-day limit, photos first.
export async function purgeExpiredVerifications(sql: postgres.Sql, store: PhotoStore): Promise<number> {
  const expired = await sql`
    select id, id_card_path, selfie_path from verification_requests where delete_after < now()`;
  if (expired.length === 0) return 0;
  await store.remove(expired.flatMap((r) => [r.id_card_path, r.selfie_path]));
  const ids = expired.map((r) => r.id);
  await sql`update moderation_queue set resolved_at = now() where item_id = any(${ids}) and resolved_at is null`;
  await sql`delete from verification_requests where id = any(${ids})`;
  return expired.length;
}
