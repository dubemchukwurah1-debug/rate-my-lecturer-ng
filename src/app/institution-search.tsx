"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type Institution, type InstitutionType, type Ownership, TYPE_LABELS } from "@/lib/institutions";

export default function InstitutionSearch({ institutions }: { institutions: Institution[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<InstitutionType | "">("");
  const [ownership, setOwnership] = useState<Ownership | "">("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return institutions
      .filter((i) => !type || i.type === type)
      .filter((i) => !ownership || i.ownership === ownership)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.state.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [institutions, query, type, ownership]);

  return (
    <section className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by school or state, e.g. UNILAG, Kano"
        className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
        aria-label="Search institutions"
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <select value={type} onChange={(e) => setType(e.target.value as InstitutionType | "")} className="rounded border px-2 py-1 dark:bg-neutral-900" aria-label="Type">
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={ownership} onChange={(e) => setOwnership(e.target.value as Ownership | "")} className="rounded border px-2 py-1 dark:bg-neutral-900" aria-label="Ownership">
          <option value="">All ownership</option>
          <option value="federal">Federal</option>
          <option value="state">State</option>
          <option value="private">Private</option>
        </select>
        <span className="self-center text-neutral-500">{results.length} institutions</span>
      </div>
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {results.slice(0, 100).map((i) => (
          <li key={i.slug}>
            <Link href={`/institutions/${i.slug}`} className="flex justify-between gap-4 py-3 hover:underline">
              <span>{i.name}</span>
              <span className="shrink-0 text-sm text-neutral-500 capitalize">{i.ownership} · {i.state}</span>
            </Link>
          </li>
        ))}
      </ul>
      {results.length > 100 && <p className="text-sm text-neutral-500">Showing the first 100. Narrow your search to see more.</p>}
    </section>
  );
}
