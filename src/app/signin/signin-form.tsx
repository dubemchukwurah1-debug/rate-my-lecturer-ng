"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import FormErrors from "@/components/form-errors";

export default function SignInForm() {
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) return setErrors([error.message]);
    setSent(true);
  }

  if (sent) return <p className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">Check your email for a sign-in link.</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input type="email" name="email" required autoComplete="email" className="rounded border px-3 py-2 dark:bg-neutral-900" />
      </label>
      <FormErrors messages={errors} />
      <button className="rounded-lg bg-neutral-900 px-4 py-2 text-white dark:bg-white dark:text-neutral-900">Send sign-in link</button>
    </form>
  );
}
