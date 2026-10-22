"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import FormErrors from "@/components/form-errors";
import { takeToken } from "@/lib/token-wallet";

export default function FacilityForm({ institutionSlug, categories }: { institutionSlug: string; categories: string[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setErrors([]);
    try {
      const token = await takeToken();
      const res = await fetch("/api/facilities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          issue: {
            institutionSlug,
            category: form.get("category"),
            title: form.get("title"),
            description: form.get("description"),
            location: (form.get("location") as string) || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.issues ?? (data.fields ? Object.values(data.fields).flat() : [data.error]));
        return;
      }
      router.push(`/institutions/${institutionSlug}`);
      router.refresh();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Something went wrong"]);
    } finally {
      setSending(false);
    }
  }

  const input = "rounded border px-2 py-1.5 dark:bg-neutral-900";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Category *
        <select name="category" className={input}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">Title *<input name="title" required minLength={10} maxLength={120} className={input} /></label>
      <label className="flex flex-col gap-1 text-sm">Where on campus<input name="location" maxLength={120} placeholder="e.g. Faculty of Science lecture theatre" className={input} /></label>
      <label className="flex flex-col gap-1 text-sm">
        What is wrong, and since when? *
        <textarea name="description" required minLength={30} maxLength={2000} rows={5} className={input} />
      </label>
      <FormErrors messages={errors} />
      <button disabled={sending} className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
        {sending ? "Posting…" : "Post issue"}
      </button>
    </form>
  );
}
