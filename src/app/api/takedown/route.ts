import { NextResponse } from "next/server";
import { handleError, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { submitTakedown, takedownSchema, TakedownError } from "@/lib/takedown";

// Open to anyone, including staff and their lawyers who have no account.
export async function POST(request: Request) {
  try {
    await submitTakedown(db(), takedownSchema.parse(await request.json()));
    return NextResponse.json({ status: "received" }, { status: 201 });
  } catch (err) {
    if (err instanceof TakedownError) return jsonError(err.message, 400);
    return handleError(err);
  }
}
