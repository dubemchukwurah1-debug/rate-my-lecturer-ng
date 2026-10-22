import "server-only";
import { db } from "./db";
import { supabaseConfigured, supabaseForRequest } from "./supabase-server";

export interface User {
  id: string;
  email: string | null;
}

export interface Student {
  userId: string;
  institutionId: string | null;
  isAlumni: boolean;
}

export async function currentUser(): Promise<User | null> {
  // Local development without Supabase Auth: act as a fixed test account.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_FAKE_USER_ID) {
    return { id: process.env.DEV_FAKE_USER_ID, email: process.env.DEV_FAKE_EMAIL ?? null };
  }
  if (!supabaseConfigured()) return null;
  const { data } = await (await supabaseForRequest()).auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
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
