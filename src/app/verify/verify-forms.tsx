"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import FormErrors from "@/components/form-errors";

interface Option {
  slug: string;
  name: string;
}

export default function VerifyForms({ emailDomain, institutions }: { emailDomain: string | null; institutions: Option[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [suggested, setSuggested] = useState(false);

  async function submitId(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setErrors([]);
    const res = await fetch("/api/verification", { method: "POST", body: new FormData(e.currentTarget) });
    const data = await res.json();
    setSending(false);
    if (!res.ok) return setErrors([data.error]);
    router.refresh();
  }

  async function suggestDomain(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ institutionSlug: form.get("institutionSlug"), domain: form.get("domain") }),
    });
    const data = await res.json();
    if (!res.ok) return setErrors([data.fields ? String(Object.values(data.fields).flat()[0]) : data.error]);
    setSuggested(true);
  }

  const input = "rounded border px-2 py-1.5 dark:bg-neutral-900";
  const schoolSelect = (
    <select name="institutionSlug" required className={input} defaultValue="">
      <option value="" disabled>Choose your institution</option>
      {institutions.map((i) => <option key={i.slug} value={i.slug}>{i.name}</option>)}
    </select>
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Verify with your student ID card</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A moderator compares your ID card with a selfie. Both photos are deleted once they decide, and within 7 days at
          most. Your reviews are never linked to these photos.
        </p>
        <form onSubmit={submitId} className="flex flex-col gap-3">
          {schoolSelect}
          <label className="flex flex-col gap-1 text-sm">
            Matric or registration number on the card
            <input name="idNumber" required minLength={4} maxLength={40} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Photo of your student ID card
            <input name="idCard" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Selfie holding the card
            <input name="selfie" type="file" accept="image/jpeg,image/png,image/webp" capture="user" required />
          </label>
          <FormErrors messages={errors} />
          <button disabled={sending} className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
            {sending ? "Uploading…" : "Send for checking"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Does your school give students an email address?</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {emailDomain ? `We don't recognise ${emailDomain} as a student email domain yet. ` : ""}
          Tell us your school&apos;s student email domain. Once a moderator confirms it, students who sign in with it are
          verified straight away.
        </p>
        {suggested ? (
          <p className="text-sm">Thanks. A moderator will check it.</p>
        ) : (
          <form onSubmit={suggestDomain} className="flex flex-col gap-3">
            {schoolSelect}
            <input name="domain" required placeholder="student.unilag.edu.ng" className={input} />
            <button className="rounded-lg border px-4 py-2">Suggest domain</button>
          </form>
        )}
      </section>
    </div>
  );
}
