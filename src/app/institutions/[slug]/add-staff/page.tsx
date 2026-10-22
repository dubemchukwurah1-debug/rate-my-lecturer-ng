import { notFound } from "next/navigation";
import { getInstitution } from "@/lib/institutions";
import AddStaffForm from "./add-staff-form";

export default async function AddStaffPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const institution = getInstitution(slug);
  if (!institution) notFound();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Add a lecturer or staff member</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        At {institution.name}. A moderator checks every new profile before it appears.
      </p>
      <AddStaffForm institutionSlug={slug} />
    </main>
  );
}
