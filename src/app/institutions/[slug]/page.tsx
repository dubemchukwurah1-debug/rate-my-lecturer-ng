import Link from "next/link";
import { notFound } from "next/navigation";
import { getInstitution, institutions, TYPE_LABELS } from "@/lib/institutions";

export function generateStaticParams() {
  return institutions.map((i) => ({ slug: i.slug }));
}

export default async function InstitutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const institution = getInstitution(slug);
  if (!institution) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← All institutions</Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{institution.name}</h1>
        <p className="text-neutral-600 capitalize dark:text-neutral-400">
          {institution.ownership} {TYPE_LABELS[institution.type].toLowerCase()} · {institution.state} State
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-neutral-300 p-6 text-neutral-500 dark:border-neutral-700">
        Staff ratings, the facilities board and flags arrive in Phase 1.
      </section>
      <p className="text-xs text-neutral-500">
        Listing source: <a href={institution.source} className="underline">{new URL(institution.source).hostname}</a>
      </p>
    </main>
  );
}
