import CaseForm from "./case-form";

export default function CasePage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Follow your report</h1>
      <CaseForm />
    </main>
  );
}
