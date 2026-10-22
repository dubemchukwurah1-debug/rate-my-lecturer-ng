import InstitutionSearch from "./institution-search";
import { institutions } from "@/lib/institutions";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Rate your lecturers</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Honest, anonymous reviews of lecturers and staff at Nigerian universities, polytechnics and colleges of education,
          from verified students.
        </p>
      </header>
      <InstitutionSearch institutions={institutions} />
    </main>
  );
}
