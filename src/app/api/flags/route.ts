import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonError } from "@/lib/api";
import { ISSUE_MESSAGES } from "@/lib/content-checks";
import { db } from "@/lib/db";
import { fileReport, reportSchema } from "@/lib/flags";
import { tokenSchema } from "@/lib/reviews";

// Anonymous like reviews: the token proves a verified student, nothing else.
const bodySchema = z.object({ token: tokenSchema, report: reportSchema });

export async function POST(request: Request) {
  try {
    const { token, report } = bodySchema.parse(await request.json());
    const result = await fileReport(db(), report, token);
    if (result.status === "rejected") {
      return jsonError("Please edit your report", 422, { issues: result.issues.map((i) => ISSUE_MESSAGES[i]) });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
