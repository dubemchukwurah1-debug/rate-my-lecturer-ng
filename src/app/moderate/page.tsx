import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isModerator } from "@/lib/auth";
import { db, hasDatabase } from "@/lib/db";
import { openQueue, resolveItem } from "@/lib/moderation";

export const dynamic = "force-dynamic";

const LABELS = { staff: "New staff profile", review: "Held review", facility_issue: "Facility post" };

async function resolve(formData: FormData) {
  "use server";
  if (!(await isModerator())) throw new Error("Not a moderator");
  const id = z.guid().parse(formData.get("id"));
  await resolveItem(db(), id, formData.get("decision") === "approve");
  revalidatePath("/moderate");
}

export default async function ModeratePage() {
  // Anyone else gets a plain 404, so the page's existence is not advertised.
  if (!hasDatabase() || !(await isModerator())) notFound();
  const items = await openQueue(db());

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Moderation queue</h1>
      {items.length === 0 && <p className="text-neutral-500">Nothing waiting.</p>}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <p className="text-xs text-neutral-500">
              {LABELS[item.itemType]} · {item.reason.replace("_", " ")} · {item.institution}
            </p>
            <p className="whitespace-pre-line">{item.summary}</p>
            <form action={resolve} className="flex gap-2">
              <input type="hidden" name="id" value={item.id} />
              <button name="decision" value="approve" className="rounded bg-green-700 px-3 py-1 text-sm text-white">Approve</button>
              <button name="decision" value="reject" className="rounded bg-red-700 px-3 py-1 text-sm text-white">Reject</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
