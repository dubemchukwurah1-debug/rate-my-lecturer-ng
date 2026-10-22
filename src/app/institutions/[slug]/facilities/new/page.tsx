import { notFound } from "next/navigation";
import { FACILITY_CATEGORIES } from "@/lib/facilities";
import { getInstitution } from "@/lib/institutions";
import FacilityForm from "./facility-form";

export default async function NewFacilityIssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const institution = getInstitution(slug);
  if (!institution) notFound();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Report a facility issue</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        At {institution.name}. Posts are anonymous. Leave out exact locations of security problems.
      </p>
      <FacilityForm institutionSlug={slug} categories={[...FACILITY_CATEGORIES]} />
    </main>
  );
}
