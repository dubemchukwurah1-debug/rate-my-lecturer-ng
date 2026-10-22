"use client";

import { useState } from "react";
import FormErrors from "@/components/form-errors";
import { StarInput } from "@/components/stars";
import { takeToken } from "@/lib/token-wallet";

const TAGS = ["Clear explanations", "Gives handouts", "Strict on attendance", "Fair grading", "Clear rubrics", "Often absent", "Approachable"];

type Sub = "clarity" | "fairness" | "availability" | "respect";
// Administrative staff are rated on service rather than teaching; the stored
// columns are shared.
const SUB_LABELS: Record<"lecturer" | "administrative", Record<Sub, string>> = {
  lecturer: {
    clarity: "Clarity of teaching",
    fairness: "Fairness of grading",
    availability: "Availability",
    respect: "Respect toward students",
  },
  administrative: {
    clarity: "Helpfulness",
    fairness: "Fairness",
    availability: "Speed of service",
    respect: "Respect toward students",
  },
};

export default function ReviewForm({ staffId, role }: { staffId: string; role: "lecturer" | "administrative" }) {
  const [overall, setOverall] = useState<number>();
  const [subs, setSubs] = useState<Partial<Record<Sub, number>>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [redirectToReport, setRedirectToReport] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [held, setHeld] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!overall) return setErrors(["Choose an overall rating."]);
    setState("sending");
    setErrors([]);
    setRedirectToReport(false);
    try {
      const token = await takeToken();
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          review: {
            staffId,
            courseCode: (form.get("courseCode") as string) || undefined,
            semester: form.get("semester"),
            overall,
            ...subs,
            wouldTakeAgain: form.get("wouldTakeAgain") ? form.get("wouldTakeAgain") === "yes" : undefined,
            tags,
            body: form.get("body"),
            isAlumni: form.get("isAlumni") === "on",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const fieldErrors = data.fields ? Object.values(data.fields).flat() : [];
        setErrors(data.issues ?? (fieldErrors.length ? fieldErrors : [data.error]));
        setRedirectToReport(Boolean(data.redirectToReport));
        setState("idle");
        return;
      }
      setHeld(data.status === "held");
      setState("done");
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Something went wrong"]);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
        {held
          ? "Thanks. Your review is held for a quick moderator check because this profile got many reviews today."
          : "Thanks. Your review will appear after the usual 48-hour wait."}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">Write a review</h2>
      <p className="text-sm text-neutral-500">Anonymous. Not even we can tell who wrote it. Describe your own experience.</p>
      <StarInput name="overall" label="Overall" value={overall} onChange={setOverall} required />
      {(Object.keys(SUB_LABELS[role]) as Sub[]).map((k) => (
        <StarInput
          key={k}
          name={k}
          label={SUB_LABELS[role][k]}
          value={subs[k]}
          onChange={(v) => setSubs((s) => ({ ...s, [k]: v }))}
        />
      ))}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Course code
          <input name="courseCode" placeholder="CSC 201" className="rounded border px-2 py-1.5 dark:bg-neutral-900" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Session / semester *
          <input name="semester" required placeholder="2025/2026 first" className="rounded border px-2 py-1.5 dark:bg-neutral-900" />
        </label>
      </div>
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1">{role === "lecturer" ? "Would you take this lecturer again?" : "Would you recommend them?"}</legend>
        <label><input type="radio" name="wouldTakeAgain" value="yes" /> Yes</label>
        <label><input type="radio" name="wouldTakeAgain" value="no" /> No</label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 5 ? [...cur, t] : cur))}
            aria-pressed={tags.includes(t)}
            className={`rounded-full border px-3 py-1 text-sm ${tags.includes(t) ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Your review * (50 to 1,000 characters)
        <textarea name="body" required minLength={50} maxLength={1000} rows={5} className="rounded border px-2 py-1.5 dark:bg-neutral-900" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isAlumni" /> I have graduated or left this school
      </label>
      <FormErrors messages={errors} />
      {redirectToReport && (
        <a href={`/staff/${staffId}/report?colour=red`} className="text-sm font-medium underline">
          File a private misconduct report instead
        </a>
      )}
      <button disabled={state === "sending"} className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
        {state === "sending" ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
