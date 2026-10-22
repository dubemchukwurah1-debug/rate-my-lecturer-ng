import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { currentUserId } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { staffProfile } from "@/lib/queries";
import ClaimForm from "./claim-form";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDatabase() || !z.guid().safeParse(id).success) notFound();
  const staff = await staffProfile(id);
  if (!staff) notFound();
  const signedIn = Boolean(await currentUserId());
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Claim {staff.fullName}&apos;s profile</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Claiming lets you reply publicly to reviews and respond to any case before it is published. It does not let you edit
        or remove reviews. A moderator checks every claim.
      </p>
      {signedIn ? (
        <ClaimForm staffId={staff.id} />
      ) : (
        <p>
          <Link href="/signin" className="underline">Sign in</Link> first, ideally with your official staff email.
        </p>
      )}
    </main>
  );
}
