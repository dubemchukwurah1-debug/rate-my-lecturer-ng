import { NextResponse } from "next/server";
import { handleError, jsonError } from "@/lib/api";
import { verifiedStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { proposeStaff, staffProposalSchema } from "@/lib/staff";

export async function POST(request: Request) {
  try {
    if (!(await verifiedStudent())) return jsonError("Verify your student status first", 401);
    const id = await proposeStaff(db(), staffProposalSchema.parse(await request.json()));
    return NextResponse.json({ id, status: "pending" }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
