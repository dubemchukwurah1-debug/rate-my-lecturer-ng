import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isModerator } from "@/lib/auth";
import { db, hasDatabase } from "@/lib/db";
import { decideCase, openRedCases, proposeRedFlag, publishRedFlag, RED_MIN_CREDIBLE } from "@/lib/flags";
import { decideTakedown, openTakedowns } from "@/lib/takedown";

export const dynamic = "force-dynamic";

async function moderatorOrThrow() {
  const id = await isModerator();
  if (!id) throw new Error("Not a moderator");
  return id;
}

async function decide(form: FormData) {
  "use server";
  const by = await moderatorOrThrow();
  const decision = z.enum(["panel_review", "kept_on_file", "dismissed"]).parse(form.get("decision"));
  await decideCase(db(), z.guid().parse(form.get("reportId")), by, decision, String(form.get("reasons") ?? ""));
  revalidatePath("/panel");
}

async function propose(form: FormData) {
  "use server";
  const by = await moderatorOrThrow();
  await proposeRedFlag(db(), z.guid().parse(form.get("staffId")), by, String(form.get("reasons") ?? ""), String(form.get("extraNotice") ?? ""));
  revalidatePath("/panel");
}

async function publish(form: FormData) {
  "use server";
  const by = await moderatorOrThrow();
  await publishRedFlag(db(), z.guid().parse(form.get("staffId")), by, String(form.get("reasons") ?? ""));
  revalidatePath("/panel");
}

async function takedown(form: FormData) {
  "use server";
  const by = await moderatorOrThrow();
  await decideTakedown(db(), z.guid().parse(form.get("id")), by, form.get("decision") === "remove", String(form.get("reasons") ?? ""));
  revalidatePath("/panel");
}

const input = "rounded border px-2 py-1.5 text-sm dark:bg-neutral-900";

export default async function PanelPage() {
  if (!hasDatabase() || !(await isModerator())) notFound();
  const [groups, takedowns] = await Promise.all([openRedCases(db()), openTakedowns(db())]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Review panel</h1>
        <Link href="/moderate" className="text-sm underline">Moderation queue</Link>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Standard: credible, specific, first-hand reports. Never a finding of guilt. Publication needs {RED_MIN_CREDIBLE} credible
        reports or an official outcome, notice to the staff member, and 7 days for their reply. Members with a tie to the
        institution step aside. Check that published details cannot identify the reporter.
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Takedown and appeal requests</h2>
        {takedowns.length === 0 && <p className="text-sm text-neutral-500">None open.</p>}
        {takedowns.map((t) => (
          <article key={t.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
            <p className={`text-xs ${new Date(t.dueBy) < new Date() ? "font-medium text-red-700" : "text-neutral-500"}`}>
              From: {t.requesterRole} · {t.contactEmail ?? "no email"} · answer by {new Date(t.dueBy).toLocaleString()}
            </p>
            <p className="rounded bg-neutral-100 p-2 dark:bg-neutral-900">{t.content}</p>
            <p className="whitespace-pre-line">{t.reason}</p>
            {t.staffId && <Link href={`/staff/${t.staffId}`} className="w-fit text-xs underline">Open profile</Link>}
            <form action={takedown} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={t.id} />
              <textarea name="reasons" required minLength={10} rows={2} placeholder="Reasons (recorded)" className={input} />
              <div className="flex gap-2">
                <button name="decision" value="remove" className="rounded bg-red-700 px-3 py-1 text-white">Remove</button>
                <button name="decision" value="keep" className="rounded bg-neutral-700 px-3 py-1 text-white">Keep</button>
              </div>
            </form>
          </article>
        ))}
      </section>

      <h2 className="text-lg font-semibold">Red-flag cases</h2>
      {groups.length === 0 && <p className="text-neutral-500">No open cases.</p>}
      {groups.map((g) => {
        const credible = g.cases.filter((c) => c.status === "kept_on_file").length;
        const awaiting = g.cases.some((c) => c.status === "awaiting_reply");
        const due = g.flag?.replyDeadline && new Date(g.flag.replyDeadline) <= new Date();
        return (
          <section key={g.staffId} className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="font-semibold">
              <Link href={`/staff/${g.staffId}`} className="underline">{g.staffName}</Link> · {g.institution}
            </h2>
            {g.cases.map((c) => (
              <article key={c.id} className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <p className="text-xs text-neutral-500">
                  {c.caseNumber} · {c.category} · {c.status.replaceAll("_", " ")} · filed {new Date(c.createdAt).toDateString()}
                  {c.referralConsent && " · wants help with a referral"}
                </p>
                <p className="whitespace-pre-line text-sm">{c.details.details}</p>
                <p className="text-xs text-neutral-500">
                  {[c.details.occurredOn, c.details.courseCode].filter(Boolean).join(" · ")}
                  {c.officialOutcomeUrl && <> · <a href={c.officialOutcomeUrl} className="underline">official outcome</a></>}
                </p>
                {!["awaiting_reply"].includes(c.status) && (
                  <form action={decide} className="flex flex-col gap-2">
                    <input type="hidden" name="reportId" value={c.id} />
                    <textarea name="reasons" required minLength={10} rows={2} placeholder="Reasons (recorded)" className={input} />
                    <div className="flex flex-wrap gap-2">
                      {c.status === "received" && <button name="decision" value="panel_review" className="rounded border px-3 py-1 text-sm">Send to panel</button>}
                      <button name="decision" value="kept_on_file" className="rounded border px-3 py-1 text-sm">Credible: keep on file</button>
                      <button name="decision" value="dismissed" className="rounded border px-3 py-1 text-sm">Dismiss</button>
                    </div>
                  </form>
                )}
              </article>
            ))}
            {g.response && <p className="text-sm">Staff response: {g.response}</p>}
            {!awaiting && credible > 0 && (
              <form action={propose} className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <p className="text-sm">{credible} credible report(s). Start the 7-day reply window:</p>
                <input type="hidden" name="staffId" value={g.staffId} />
                <p className="text-xs text-neutral-500">
                  The staff member is told through their portal if they have claimed the profile; otherwise a neutral notice
                  shows on the profile for 7 days.
                </p>
                <input name="extraNotice" placeholder="Any other notice given (optional, recorded)" className={input} />
                <textarea name="reasons" required minLength={10} rows={2} placeholder="Reasons (recorded)" className={input} />
                <button className="w-fit rounded bg-amber-700 px-3 py-1 text-sm text-white">Start reply window</button>
              </form>
            )}
            {awaiting && (
              <form action={publish} className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <p className="text-sm">
                  Reply window ends {g.flag?.replyDeadline ? new Date(g.flag.replyDeadline).toDateString() : "?"}.
                </p>
                <input type="hidden" name="staffId" value={g.staffId} />
                <textarea name="reasons" required minLength={10} rows={2} placeholder="Reasons (recorded)" className={input} />
                <button disabled={!due} className="w-fit rounded bg-red-700 px-3 py-1 text-sm text-white disabled:opacity-50">Publish red flag</button>
              </form>
            )}
          </section>
        );
      })}
    </main>
  );
}
