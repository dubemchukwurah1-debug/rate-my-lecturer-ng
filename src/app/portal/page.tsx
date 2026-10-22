import { revalidatePath } from "next/cache";
import Link from "next/link";
import { z } from "zod";
import { currentUserId } from "@/lib/auth";
import { db, hasDatabase } from "@/lib/db";
import { replySchema, replyToReview, respondToFlag } from "@/lib/staff-portal";

export const dynamic = "force-dynamic";

async function reply(form: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in first");
  const { body } = replySchema.parse({ body: form.get("body") });
  await replyToReview(db(), userId, z.guid().parse(form.get("reviewId")), body);
  revalidatePath("/portal");
}

async function respond(form: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in first");
  const { body } = replySchema.extend({ body: z.string().trim().min(20).max(2000) }).parse({ body: form.get("body") });
  await respondToFlag(db(), userId, z.guid().parse(form.get("staffId")), body);
  revalidatePath("/portal");
}

export default async function PortalPage() {
  const userId = await currentUserId();
  if (!userId || !hasDatabase()) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <Link href="/signin" className="underline">Sign in</Link> to use the staff portal.
      </main>
    );
  }
  const sql = db();
  const profiles = await sql`
    select s.id, s.full_name, f.reply_deadline, f.published_at, r.body as response
    from staff s
    left join published_flags f on f.staff_id = s.id and f.colour = 'red'
    left join flag_responses r on r.staff_id = s.id
    where s.claimed_by = ${userId}`;
  const reviews = await sql`
    select v.id, v.staff_id, v.overall, v.body, rr.body as reply
    from reviews v join staff s on s.id = v.staff_id left join review_replies rr on rr.review_id = v.id
    where s.claimed_by = ${userId} and v.hidden_reason is null and v.counts_from <= now()
    order by v.created_at desc limit 100`;
  const input = "rounded border px-2 py-1.5 dark:bg-neutral-900";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Staff portal</h1>
      {profiles.length === 0 && <p className="text-neutral-500">No claimed profile yet. Claim yours from your profile page.</p>}
      {profiles.map((p) => (
        <section key={p.id} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            <Link href={`/staff/${p.id}`} className="underline">{p.full_name}</Link>
          </h2>
          {p.reply_deadline && (
            <div className="flex flex-col gap-2 rounded-lg border border-red-300 p-4 dark:border-red-800">
              <p className="text-sm">
                {p.published_at
                  ? "A red flag has been published on your profile."
                  : `Students have made credible reports of serious misconduct. Unless the panel decides otherwise, a neutral notice will be published after ${new Date(p.reply_deadline).toDateString()}. You can respond below; your response is shown with it.`}
              </p>
              <form action={respond} className="flex flex-col gap-2">
                <input type="hidden" name="staffId" value={p.id} />
                <textarea name="body" defaultValue={p.response ?? ""} required minLength={20} maxLength={2000} rows={4} className={input} />
                <button className="w-fit rounded bg-neutral-900 px-3 py-1 text-sm text-white dark:bg-white dark:text-neutral-900">Save response</button>
              </form>
            </div>
          )}
          {reviews.filter((r) => r.staff_id === p.id).map((r) => (
            <article key={r.id} className="flex flex-col gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <p className="text-sm">{r.overall}★ {r.body}</p>
              <form action={reply} className="flex flex-col gap-2">
                <input type="hidden" name="reviewId" value={r.id} />
                <textarea name="body" defaultValue={r.reply ?? ""} placeholder="Reply publicly" required minLength={20} maxLength={1000} rows={2} className={input} />
                <button className="w-fit rounded border px-3 py-1 text-sm">{r.reply ? "Update reply" : "Reply"}</button>
              </form>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
