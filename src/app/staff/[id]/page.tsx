import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StarDisplay } from "@/components/stars";
import { db, hasDatabase } from "@/lib/db";
import { publicFlags } from "@/lib/flags";
import { staffProfile } from "@/lib/queries";
import { MIN_REVIEWS_FOR_SCORE } from "@/lib/scoring";
import ReviewForm from "./review-form";

export const dynamic = "force-dynamic";

const FLAG_STYLES = {
  red: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950",
  yellow: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
  green: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950",
};

const SUB_LABELS = {
  lecturer: { clarity: "Clarity", fairness: "Fair grading", availability: "Availability", respect: "Respect" },
  administrative: { clarity: "Helpfulness", fairness: "Fairness", availability: "Speed of service", respect: "Respect" },
};

export default async function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDatabase() || !z.guid().safeParse(id).success) notFound();
  const staff = await staffProfile(id);
  if (!staff) notFound();
  const flags = await publicFlags(db(), staff.id);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href={`/institutions/${staff.institutionSlug}`} className="text-sm text-neutral-500 hover:underline">
        ← {staff.institutionName}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          {staff.title ? `${staff.title} ` : ""}
          {staff.fullName}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {staff.role === "lecturer" ? "Lecturer" : "Administrative staff"}
          {staff.department ? ` · ${staff.department}` : ""}
          {staff.status === "left" ? " · No longer at this institution" : ""}
        </p>
      </header>

      {flags.length > 0 && (
        <section className="flex flex-col gap-2">
          {flags.map((f) => (
            <div key={f.colour} className={`rounded-lg border p-3 text-sm ${FLAG_STYLES[f.colour]}`}>
              <p className="font-medium">
                {f.colour[0].toUpperCase() + f.colour.slice(1)} flag · {f.reportCount} reports
              </p>
              <p>{f.text}</p>
              {f.officialOutcomeUrl && (
                <a href={f.officialOutcomeUrl} className="underline" rel="nofollow noopener">Official outcome</a>
              )}
              {f.colour === "red" && (
                <p className="mt-2 text-xs">
                  {f.response ? `Response from ${staff.fullName}: ${f.response}` : `${staff.fullName} was given 7 days to respond and did not.`}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        {staff.score ? (
          <div className="flex flex-col gap-2">
            <p className="text-3xl font-bold">
              {staff.score.overall} <StarDisplay value={staff.score.overall} />
            </p>
            <p className="text-sm text-neutral-500">From {staff.score.reviewCount} reviews, recent ones weighted more.</p>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              {Object.entries(staff.score.subScores).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt>{SUB_LABELS[staff.role][k as keyof (typeof SUB_LABELS)["lecturer"]]}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="text-neutral-500">
            A score shows once {MIN_REVIEWS_FOR_SCORE} students have reviewed. {staff.reviews.length} so far.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {staff.reviews.length === 0 && <p className="text-neutral-500">No reviews yet.</p>}
        {staff.reviews.map((r) => (
          <article key={r.id} className="flex flex-col gap-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StarDisplay value={r.overall} label="Overall" />
              {r.courseCode && <span className="font-mono">{r.courseCode}</span>}
              <span className="text-neutral-500">{r.semester}</span>
              {r.isAlumni && <span className="rounded bg-neutral-100 px-1.5 text-xs dark:bg-neutral-800">Alumni</span>}
              {r.wouldTakeAgain != null && (
                <span className="text-neutral-500">{r.wouldTakeAgain ? "Would recommend" : "Would not recommend"}</span>
              )}
            </div>
            <p className="whitespace-pre-line">{r.body}</p>
            {r.tags.length > 0 && <p className="text-xs text-neutral-500">{r.tags.join(" · ")}</p>}
            {r.reply && (
              <blockquote className="border-l-2 border-neutral-300 pl-3 text-sm text-neutral-600 dark:text-neutral-400">
                Response from {staff.fullName}: {r.reply}
              </blockquote>
            )}
          </article>
        ))}
      </section>

      <ReviewForm staffId={staff.id} role={staff.role} />

      <section className="flex flex-wrap gap-4 text-sm">
        <Link href={`/staff/${staff.id}/report`} className="underline">Flag this person</Link>
        <Link href={`/staff/${staff.id}/report?colour=red`} className="underline">Report serious misconduct privately</Link>
        <Link href={`/staff/${staff.id}/claim`} className="text-neutral-500 underline">Are you {staff.fullName}? Claim this profile</Link>
      </section>
    </main>
  );
}
