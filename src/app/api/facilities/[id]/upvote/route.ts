import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, jsonError } from "@/lib/api";
import { verifiedStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { upvoteFacilityIssue } from "@/lib/facilities";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const student = await verifiedStudent();
    if (!student) return jsonError("Verify your student status first", 401);
    const id = z.guid().parse((await params).id);
    const counted = await upvoteFacilityIssue(db(), id, student.userId);
    return NextResponse.json({ counted });
  } catch (err) {
    return handleError(err);
  }
}
