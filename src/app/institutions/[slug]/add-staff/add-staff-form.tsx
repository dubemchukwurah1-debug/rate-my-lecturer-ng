"use client";

import Link from "next/link";
import { useState } from "react";
import FormErrors from "@/components/form-errors";

export default function AddStaffForm({ institutionSlug }: { institutionSlug: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        institutionSlug,
        fullName: form.get("fullName"),
        title: (form.get("title") as string) || undefined,
        role: form.get("role"),
        department: (form.get("department") as string) || undefined,
        courseCodes: String(form.get("courseCodes") ?? "").split(",").map((c) => c.trim()).filter(Boolean),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setErrors(data.fields ? (Object.values(data.fields).flat() as string[]) : [data.error]);
    setDone(true);
  }

  if (done) {
    return (
      <p className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
        Thanks. A moderator will check this profile shortly. <Link href={`/institutions/${institutionSlug}`} className="underline">Back to the school</Link>
      </p>
    );
  }

  const input = "rounded border px-2 py-1.5 dark:bg-neutral-900";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">Full name *<input name="fullName" required minLength={5} className={input} /></label>
      <label className="flex flex-col gap-1 text-sm">Title<input name="title" placeholder="Dr, Prof, Mr, Mrs" className={input} /></label>
      <label className="flex flex-col gap-1 text-sm">
        Role *
        <select name="role" className={input}>
          <option value="lecturer">Lecturer</option>
          <option value="administrative">Administrative staff</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">Department<input name="department" className={input} /></label>
      <label className="flex flex-col gap-1 text-sm">Courses taught (comma separated)<input name="courseCodes" placeholder="CSC 201, CSC 305" className={input} /></label>
      <FormErrors messages={errors} />
      <button className="rounded-lg bg-neutral-900 px-4 py-2 text-white dark:bg-white dark:text-neutral-900">Submit for review</button>
    </form>
  );
}
