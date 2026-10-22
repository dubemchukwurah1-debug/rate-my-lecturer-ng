import SignInForm from "./signin-form";

export default function SignInPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Use your school email if you have one; you are verified straight away. Otherwise use any email and verify with your
        student ID card.
      </p>
      {configured ? <SignInForm /> : <p className="text-neutral-500">Sign-in is not set up in this environment yet.</p>}
    </main>
  );
}
