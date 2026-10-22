"use client";

import { useActionState } from "react";
import { lookUpCase } from "./actions";

export default function CaseForm() {
  const [status, action, pending] = useActionState(lookUpCase, null);
  const input = "rounded border px-2 py-1.5 font-mono dark:bg-neutral-900";
  return (
    <>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">Case number<input name="n" required className={input} /></label>
        <label className="flex flex-col gap-1 text-sm">Case key<input name="k" required type="password" className={input} /></label>
        <button disabled={pending} className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          Check
        </button>
      </form>
      {status && <p className="rounded-lg border p-4">{status}</p>}
    </>
  );
}
