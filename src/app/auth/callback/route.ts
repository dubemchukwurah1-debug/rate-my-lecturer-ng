import { NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase-server";

// Lands here from the emailed sign-in link and swaps the code for a session.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await supabaseForRequest()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/verify", url.origin));
  }
  return NextResponse.redirect(new URL("/signin?error=link", url.origin));
}
