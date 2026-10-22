import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { purgeExpiredVerifications } from "@/lib/verification";
import { supabasePhotoStore } from "@/lib/verification-storage";

// Daily (vercel.json): deletes ID-check photos older than 7 days.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return jsonError("Unauthorized", 401);
  const purged = await purgeExpiredVerifications(db(), supabasePhotoStore());
  return NextResponse.json({ purged });
}
