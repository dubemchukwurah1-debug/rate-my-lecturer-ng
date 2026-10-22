import { z } from "zod";
import { RESPONSE_HOURS } from "@/lib/takedown";
import TakedownForm from "./takedown-form";

export const metadata = { title: "Appeal or request removal" };

const TARGETS = { flag: "flag", review: "review", facility_issue: "facility post" } as const;

export default async function TakedownPage({ searchParams }: { searchParams: Promise<{ type?: string; id?: string }> }) {
  const { type, id } = await searchParams;
  const targetType = z.enum(["flag", "review", "facility_issue"]).safeParse(type);
  const targetId = z.guid().safeParse(id);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Appeal or request removal</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        If something on this site about you is false, unfair or breaks the law, tell us here. A moderator reviews every
        request within {RESPONSE_HOURS} hours and records the decision with reasons. We never reveal who wrote a review or
        report.
      </p>
      {targetType.success && targetId.success ? (
        <TakedownForm targetType={targetType.data} targetId={targetId.data} targetLabel={TARGETS[targetType.data]} />
      ) : (
        <p className="rounded-lg border p-4 text-sm">
          Open the flag, review or facility post you are concerned about and use its &quot;Appeal or request
          removal&quot; or &quot;Report&quot; link.
        </p>
      )}
    </main>
  );
}
