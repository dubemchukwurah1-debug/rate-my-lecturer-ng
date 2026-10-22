import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isModerator } from "@/lib/auth";
import { db, hasDatabase } from "@/lib/db";
import { openQueue, resolveItem, verificationPhotos } from "@/lib/moderation";
import { supabasePhotoStore } from "@/lib/verification-storage";

export const dynamic = "force-dynamic";

const LABELS = {
  staff: "New staff profile",
  review: "Held review",
  facility_issue: "Facility post",
  verification: "Student ID check",
  domain: "Student email domain",
  flag: "Flag",
  staff_claim: "Staff profile claim",
};

async function resolve(formData: FormData) {
  "use server";
  if (!(await isModerator())) throw new Error("Not a moderator");
  const id = z.guid().parse(formData.get("id"));
  await resolveItem(db(), id, formData.get("decision") === "approve", supabasePhotoStore());
  revalidatePath("/moderate");
}

export default async function ModeratePage() {
  // Anyone else gets a plain 404, so the page's existence is not advertised.
  if (!hasDatabase() || !(await isModerator())) notFound();
  const items = await openQueue(db());
  const store = supabasePhotoStore();
  const photos = new Map(
    await Promise.all(
      items
        .filter((i) => i.itemType === "verification")
        .map(async (i) => [i.itemId, await verificationPhotos(db(), store, i.itemId).catch(() => null)] as const),
    ),
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Moderation queue</h1>
        <Link href="/panel" className="text-sm underline">Review panel</Link>
      </div>
      {items.length === 0 && <p className="text-neutral-500">Nothing waiting.</p>}
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const pics = photos.get(item.itemId);
          return (
            <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-xs text-neutral-500">
                {LABELS[item.itemType]} · {item.reason.replace("_", " ")} · {item.institution}
              </p>
              {item.reason === "duplicate_id" && (
                <p className="text-sm font-medium text-red-700">This ID card number is already used by another account.</p>
              )}
              <p className="whitespace-pre-line">{item.summary}</p>
              {pics && (
                <div className="grid grid-cols-2 gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs */}
                  <img src={pics.idCard} alt="ID card" className="rounded border" />
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs */}
                  <img src={pics.selfie} alt="Selfie" className="rounded border" />
                </div>
              )}
              {item.reason === "red_report" ? (
                <Link href="/panel" className="text-sm underline">Open in the review panel</Link>
              ) : (
              <form action={resolve} className="flex gap-2">
                <input type="hidden" name="id" value={item.id} />
                <button name="decision" value="approve" className="rounded bg-green-700 px-3 py-1 text-sm text-white">Approve</button>
                <button name="decision" value="reject" className="rounded bg-red-700 px-3 py-1 text-sm text-white">Reject</button>
              </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
