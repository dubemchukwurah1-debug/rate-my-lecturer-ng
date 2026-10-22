import { NextResponse } from "next/server";
import { handleError, jsonError } from "@/lib/api";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { domainSuggestionSchema, suggestDomain, VerificationError } from "@/lib/verification";

export async function POST(request: Request) {
  try {
    if (!(await currentUserId())) return jsonError("Sign in first", 401);
    await suggestDomain(db(), domainSuggestionSchema.parse(await request.json()));
    return NextResponse.json({ status: "pending" }, { status: 201 });
  } catch (err) {
    if (err instanceof VerificationError) return jsonError(err.message, 400);
    return handleError(err);
  }
}
