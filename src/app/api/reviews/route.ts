import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonError } from "@/lib/api";
import { ISSUE_MESSAGES } from "@/lib/content-checks";
import { db } from "@/lib/db";
import { reviewSchema, submitReview, tokenSchema } from "@/lib/reviews";

// No session is read here: the spent token alone proves a verified student wrote it.
const bodySchema = z.object({ token: tokenSchema, review: reviewSchema });

export async function POST(request: Request) {
  try {
    const { token, review } = bodySchema.parse(await request.json());
    const result = await submitReview(db(), review, token);
    if (result.status === "rejected") {
      return jsonError("Please edit your review", 422, {
        issues: result.issues.map((i) => ISSUE_MESSAGES[i]),
        redirectToReport: result.redirectToReport,
      });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
