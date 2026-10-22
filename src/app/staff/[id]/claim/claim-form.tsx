"use client";

import { useState } from "react";
import FormErrors from "@/components/form-errors";

export default function ClaimForm({ staffId }: { staffId: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await fetch("/api/staff/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staffId, evidence: new FormData(e.currentTarget).get("evidence") }),
    });
    const data = await res.json();
    if (!res.ok) return setErrors(data.fields ? (Object.values(data.fields).flat() as string[]) : [data.error]);
    setDone(true);
  }

  if (done) return <p className="rounded-lg border p-4">Thanks. A moderator will check your claim. Once approved, your replies live at <a href="/portal" className="underline">/portal</a>.</p>;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        How can we confirm it is you? Give your official staff email or a link to your staff page on the school website.
        <textarea name="evidence" required minLength={20} maxLength={1000} rows={4} className="rounded border px-2 py-1.5 dark:bg-neutral-900" />
      </label>
      <FormErrors messages={errors} />
      <button className="rounded-lg bg-neutral-900 px-4 py-2 text-white dark:bg-white dark:text-neutral-900">Submit claim</button>
    </form>
  );
}
