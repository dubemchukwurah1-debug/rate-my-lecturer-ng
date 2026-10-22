"use server";

import { db, hasDatabase } from "@/lib/db";
import { caseStatus } from "@/lib/flags";

// A POST, so the case key never lands in URLs, history or server logs.
export async function lookUpCase(_prev: string | null, form: FormData): Promise<string> {
  const n = String(form.get("n") ?? "");
  const k = String(form.get("k") ?? "");
  if (!hasDatabase() || !n || !k) return "Enter your case number and key.";
  return (await caseStatus(db(), n, k)) ?? "No case matches that number and key.";
}
