import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { TokenError } from "./tokens";

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

// Maps validation and token errors to HTTP responses; anything else is a 500.
export function handleError(err: unknown) {
  if (err instanceof z.ZodError) return jsonError("Invalid input", 400, { fields: z.flattenError(err).fieldErrors });
  if (err instanceof TokenError) return jsonError(err.message, err.status);
  console.error(err);
  return jsonError("Something went wrong", 500);
}
