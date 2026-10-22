import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonError } from "@/lib/api";
import { verifiedStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueTokens } from "@/lib/tokens";

const bodySchema = z.object({ blinded: z.array(z.string().min(1)) });

export async function POST(request: Request) {
  try {
    const student = await verifiedStudent();
    if (!student) return jsonError("Verify your student status first", 401);
    const { blinded } = bodySchema.parse(await request.json());
    const signatures = await issueTokens(db(), student.userId, blinded);
    return NextResponse.json({ signatures });
  } catch (err) {
    return handleError(err);
  }
}
