import Link from "next/link";
import { notFound } from "next/navigation";
import { hasDatabase } from "@/lib/db";
import { getInstitution, TYPE_LABELS } from "@/lib/institutions";
import { facilityIssuesForInstitution, staffForInstitution } from "@/lib/queries";
import UpvoteButton from "./upvote-button";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged by school",
  in_progress: "In progress",
  fixed: "Fixed",
  stale: "No change in 90 days",
};

export default async function InstitutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const institution = getInstitution(slug);
  if (!institution) notFound();
  const connected = hasDatabase();
  const [staff, issues] = connected ? await Promise.all([staffForInstitution(slug), facilityIssuesForInstitution(slug)]) : [[], []];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← All institutions</Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{institution.name}</h1>
        <p className="text-neutral-600 capitalize dark:text-neutral-400">
          {institution.ownership} {TYPE_LABELS[institution.type].toLowerCase()} · {institution.state} State
        </p>
      </header>

      {!connected && (
        <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-neutral-500 dark:border-neutral-700">
          Reviews and the facilities board need the database, which is not connected in this environment.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Lecturers and staff</h2>
          <Link href={`/institutions/${slug}/add-staff`} className="text-sm underline">Add someone</Link>
        </div>
        {staff.length === 0 ? (
          <p className="text-neutral-500">No staff listed yet. Be the first to add one.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {staff.map((s) => (
              <li key={s.id}>
                <Link href={`/staff/${s.id}`} className="flex justify-between gap-4 py-3 hover:underline">
                  <span>{s.title ? `${s.title} ` : ""}{s.fullName}</span>
                  <span className="shrink-0 text-sm text-neutral-500">{s.department ?? (s.role === "lecturer" ? "Lecturer" : "Administrative")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Facilities board</h2>
          <Link href={`/institutions/${slug}/facilities/new`} className="text-sm underline">Report an issue</Link>
        </div>
        {issues.length === 0 ? (
          <p className="text-neutral-500">No facility issues reported yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {issues.map((f) => (
              <li key={f.id} className="flex gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                <UpvoteButton issueId={f.id} count={f.upvotes} />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{f.title}</p>
                  <p className="text-xs text-neutral-500">
                    {f.category}{f.location ? ` · ${f.location}` : ""} · {STATUS_LABELS[f.status] ?? f.status}
                  </p>
                  <p className="text-sm whitespace-pre-line">{f.description}</p>
                  <Link href={`/takedown?type=facility_issue&id=${f.id}`} className="w-fit text-xs text-neutral-500 underline">Report this post</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-neutral-500">
        Listing source: <a href={institution.source} className="underline">{new URL(institution.source).hostname}</a>
      </p>
    </main>
  );
}
