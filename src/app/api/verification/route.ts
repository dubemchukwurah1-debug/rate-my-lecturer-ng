import { NextResponse } from "next/server";
import { handleError, jsonError } from "@/lib/api";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { idVerificationSchema, submitIdVerification, VerificationError } from "@/lib/verification";
import { supabasePhotoStore } from "@/lib/verification-storage";

export async function POST(request: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) return jsonError("Sign in first", 401);
    const form = await request.formData();
    const input = idVerificationSchema.parse({
      institutionSlug: form.get("institutionSlug"),
      idNumber: form.get("idNumber"),
      idCard: form.get("idCard"),
      selfie: form.get("selfie"),
    });
    await submitIdVerification(db(), supabasePhotoStore(), userId, input);
    return NextResponse.json({ status: "pending" }, { status: 201 });
  } catch (err) {
    if (err instanceof VerificationError) return jsonError(err.message, 400);
    return handleError(err);
  }
}
