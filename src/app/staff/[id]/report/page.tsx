import { notFound } from "next/navigation";
import { z } from "zod";
import { hasDatabase } from "@/lib/db";
import { FLAG_CATEGORIES } from "@/lib/flags";
import { staffProfile } from "@/lib/queries";
import ReportForm from "./report-form";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ colour?: string }>;
}) {
  const { id } = await params;
  const { colour } = await searchParams;
  if (!hasDatabase() || !z.guid().safeParse(id).success) notFound();
  const staff = await staffProfile(id);
  if (!staff) notFound();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Flag {staff.fullName}</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Flags are anonymous. Green and yellow flags show publicly only when several students report the same thing. Red
        reports stay private: a review panel reads them, and nothing is published unless several credible reports agree and
        the staff member has had 7 days to respond.
      </p>
      <ReportForm
        staffId={staff.id}
        categories={FLAG_CATEGORIES}
        initialColour={colour === "red" || colour === "green" ? colour : "yellow"}
      />
    </main>
  );
}
