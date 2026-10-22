import { NextResponse } from "next/server";
import { publicKeyBase64 } from "@/lib/tokens";

export function GET() {
  return NextResponse.json({ publicKey: publicKeyBase64() });
}
