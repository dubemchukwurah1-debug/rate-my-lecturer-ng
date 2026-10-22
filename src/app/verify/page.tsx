import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { db, hasDatabase } from "@/lib/db";
import { emailDomain } from "@/lib/email-domains";
import { institutions } from "@/lib/institutions";
import { ensureAccount, verifyBySchoolEmail } from "@/lib/verification";
import VerifyForms from "./verify-forms";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const user = await currentUser();
  if (!user || !hasDatabase()) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <p>
          <Link href="/signin" className="underline">Sign in</Link> first.
        </p>
      </main>
    );
  }
  const sql = db();
  await ensureAccount(sql, user.id);
  let [account] = await sql`
    select a.verified_at, i.name as institution from student_accounts a
    left join institutions i on i.id = a.institution_id where a.user_id = ${user.id}`;
  if (!account.verified_at && user.email) {
    const matched = await verifyBySchoolEmail(sql, user.id, user.email);
    if (matched) account = { verified_at: new Date(), institution: matched };
  }
  const [pending] = await sql`select 1 from verification_requests where user_id = ${user.id}`;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Student verification</h1>
      {account.verified_at ? (
        <p className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          You are verified as a student of {account.institution}. You can now review lecturers and post facility issues.
          Your reviews are not linked to this account.
        </p>
      ) : pending ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          Your ID check is waiting for a moderator. Photos are deleted as soon as it is decided, and within 7 days at most.
        </p>
      ) : (
        <VerifyForms
          emailDomain={user.email ? emailDomain(user.email) : null}
          institutions={institutions.map((i) => ({ slug: i.slug, name: i.name })).sort((a, b) => a.name.localeCompare(b.name))}
        />
      )}
    </main>
  );
}
