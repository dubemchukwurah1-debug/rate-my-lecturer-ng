import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db } from "./db";

export interface Student {
  userId: string;
  institutionId: string | null;
  isAlumni: boolean;
}

export async function currentUserId(): Promise<string | null> {
  // Local development without Supabase Auth: act as a fixed test account.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_FAKE_USER_ID) return process.env.DEV_FAKE_USER_ID;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// The signed-in account, if it has passed student verification. Phone OTP is
// deferred until an SMS provider is chosen, so it is not required yet.
export async function verifiedStudent(): Promise<Student | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const [row] = await db()`
    select institution_id, is_alumni from student_accounts
    where user_id = ${userId} and verified_at is not null`;
  return row ? { userId, institutionId: row.institution_id, isAlumni: row.is_alumni } : null;
}

export async function isModerator(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const [row] = await db()`select user_id from moderators where user_id = ${userId}`;
  return row ? userId : null;
}
