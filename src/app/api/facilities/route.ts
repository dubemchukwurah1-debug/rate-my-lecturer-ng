import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonError } from "@/lib/api";
import { ISSUE_MESSAGES } from "@/lib/content-checks";
import { db } from "@/lib/db";
import { facilitySchema, postFacilityIssue } from "@/lib/facilities";
import { tokenSchema } from "@/lib/reviews";

const bodySchema = z.object({ token: tokenSchema, issue: facilitySchema });

export async function POST(request: Request) {
  try {
    const { token, issue } = bodySchema.parse(await request.json());
    const result = await postFacilityIssue(db(), issue, token);
    if (result.status === "rejected") {
      return jsonError("Please edit your post", 422, { issues: result.issues.map((i) => ISSUE_MESSAGES[i]) });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
