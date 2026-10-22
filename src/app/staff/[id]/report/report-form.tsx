"use client";

import { useState } from "react";
import FormErrors from "@/components/form-errors";
import SupportLinks from "@/components/support-links";
import { takeToken } from "@/lib/token-wallet";

type Colour = "green" | "yellow" | "red";

const COLOUR_LABELS: Record<Colour, string> = {
  green: "Green: commend good conduct",
  yellow: "Yellow: unprofessional conduct",
  red: "Red: serious misconduct (private)",
};

export default function ReportForm({
  staffId,
  categories,
  initialColour,
}: {
  staffId: string;
  categories: Record<Colour, readonly string[]>;
  initialColour: Colour;
}) {
  const [colour, setColour] = useState<Colour>(initialColour);
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [filed, setFiled] = useState<{ caseNumber: string; caseKey: string }>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setErrors([]);
    try {
      const token = await takeToken();
      const res = await fetch("/api/flags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          report: {
            staffId,
            colour,
            category: form.get("category"),
            details: form.get("details"),
            occurredOn: (form.get("occurredOn") as string) || undefined,
            courseCode: (form.get("courseCode") as string) || undefined,
            officialOutcomeUrl: (form.get("officialOutcomeUrl") as string) || undefined,
            referralConsent: form.get("referralConsent") === "on",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) return setErrors(data.issues ?? (data.fields ? Object.values(data.fields).flat() : [data.error]));
      setFiled(data);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Something went wrong"]);
    } finally {
      setSending(false);
    }
  }

  if (filed) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <p>Your report is filed. Save these two codes now; they are shown only once and are the only way to follow your case.</p>
          <p className="mt-2 font-mono text-lg">Case number: {filed.caseNumber}</p>
          <p className="font-mono text-lg">Case key: {filed.caseKey}</p>
          <p className="mt-2 text-sm">Check its progress at <a href="/case" className="underline">/case</a>.</p>
        </div>
        {colour === "red" && <SupportLinks />}
      </div>
    );
  }

  const input = "rounded border px-2 py-1.5 dark:bg-neutral-900";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm">Type of flag</legend>
        {(Object.keys(COLOUR_LABELS) as Colour[]).map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <input type="radio" name="colour" checked={colour === c} onChange={() => setColour(c)} /> {COLOUR_LABELS[c]}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Category *
        <select name="category" required className={input} key={colour}>
          {categories[colour].map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        What happened? * (first-hand, with dates and places if you can)
        <textarea name="details" required minLength={30} maxLength={4000} rows={6} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">When<input name="occurredOn" placeholder="e.g. March 2026" className={input} /></label>
        <label className="flex flex-col gap-1 text-sm">Course code<input name="courseCode" placeholder="CSC 201" className={input} /></label>
      </div>
      {colour === "red" && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Link to an official outcome, if any (court ruling, school sanction, news report)
            <input name="officialOutcomeUrl" type="url" className={input} />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="referralConsent" className="mt-1" />
            I would like help passing this to my school&apos;s committee or the police. We will never do this without your consent.
          </label>
          <p className="text-xs text-neutral-500">
            Only the review panel can read this report. Leave out details that only you would know if you are worried about
            being identified.
          </p>
        </>
      )}
      <FormErrors messages={errors} />
      <button disabled={sending} className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
        {sending ? "Filing…" : "File report"}
      </button>
    </form>
  );
}
