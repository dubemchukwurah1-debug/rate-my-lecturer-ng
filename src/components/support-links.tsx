// Where students can get help outside the platform. Kept generic: each school's own
// contacts are added to its institution page as moderators confirm them.
export default function SupportLinks() {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <h2 className="font-semibold">Getting help now</h2>
      <ul className="list-disc pl-5">
        <li>Your school&apos;s sexual harassment or student affairs committee can open an official investigation.</li>
        <li>The school&apos;s counselling unit offers confidential support.</li>
        <li>Any police station&apos;s gender desk can take a report of harassment or assault.</li>
        <li>Legal aid organisations and gender-rights NGOs can advise you for free.</li>
        <li>If you are in danger now, go somewhere safe and contact someone you trust.</li>
      </ul>
    </section>
  );
}
