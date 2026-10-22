import { NextResponse } from "next/server";
import { handleError, jsonError } from "@/lib/api";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { claimProfile, claimSchema } from "@/lib/staff-portal";

export async function POST(request: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) return jsonError("Sign in first", 401);
    await claimProfile(db(), userId, claimSchema.parse(await request.json()));
    return NextResponse.json({ status: "pending" }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /claimed|Unknown/.test(err.message)) return jsonError(err.message, 400);
    return handleError(err);
  }
}
