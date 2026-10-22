"use client";

import { useState } from "react";
import FormErrors from "@/components/form-errors";

const ROLES = {
  staff: "I am the staff member named",
  representative: "I represent the staff member (lawyer, union, employer)",
  student: "I am a student",
  other: "Other",
};

const input = "rounded border px-2 py-1.5 dark:bg-neutral-900";

export default function TakedownForm(props: { targetType: string; targetId: string; targetLabel: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/takedown", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: props.targetType,
        targetId: props.targetId,
        requesterRole: form.get("requesterRole"),
        contactEmail: form.get("contactEmail") || undefined,
        reason: form.get("reason"),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setErrors(data.fields ? (Object.values(data.fields).flat() as string[]) : [data.error]);
    setDone(true);
  }

  if (done) {
    return (
      <p className="rounded-lg border p-4">
        Received. A moderator will decide within 48 hours. If you left an email address, we will tell you the outcome.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="text-sm">About this {props.targetLabel}.</p>
      <label className="flex flex-col gap-1 text-sm">
        Who are you?
        <select name="requesterRole" required className={input}>
          {Object.entries(ROLES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        What is wrong with it, and what should happen? Include any evidence (links, case outcomes).
        <textarea name="reason" required minLength={30} maxLength={4000} rows={6} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email for the outcome (optional, erased 90 days after the decision)
        <input name="contactEmail" type="email" className={input} />
      </label>
      <FormErrors messages={errors} />
      <button className="rounded-lg bg-neutral-900 px-4 py-2 text-white dark:bg-white dark:text-neutral-900">Send request</button>
    </form>
  );
}
