"use client";

import { fromBase64, KEY_ALGORITHM, suite, toBase64, type Token } from "./token-suite";

// Anonymous tokens live only in this browser. The server signed them blind, so it
// cannot tell which account any spent token came from.
const STORAGE_KEY = "rml.tokens";
const BATCH = 5;

function load(): Token[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(tokens: Token[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Private mode: tokens last for this page only.
  }
}

async function fetchBatch(): Promise<Token[]> {
  const { publicKey: spki } = await (await fetch("/api/tokens/key")).json();
  const publicKey = await crypto.subtle.importKey("spki", fromBase64(spki), KEY_ALGORITHM, true, ["verify"]);
  const s = suite();
  const pending = await Promise.all(
    Array.from({ length: BATCH }, async () => {
      const msg = s.prepare(crypto.getRandomValues(new Uint8Array(32)));
      const { blindedMsg, inv } = await s.blind(publicKey, msg);
      return { msg, blindedMsg, inv };
    }),
  );
  const res = await fetch("/api/tokens/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blinded: pending.map((p) => toBase64(p.blindedMsg)) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not get review tokens");
  return Promise.all(
    pending.map(async (p, i) => ({
      msg: toBase64(p.msg),
      sig: toBase64(await s.finalize(publicKey, p.msg, fromBase64(data.signatures[i]), p.inv)),
    })),
  );
}

// Takes one token out of the wallet, topping it up first if empty. The token is
// removed before use, so a failed post never reuses a possibly-spent token.
export async function takeToken(): Promise<Token> {
  let tokens = load();
  if (tokens.length === 0) tokens = await fetchBatch();
  const [token, ...rest] = tokens;
  save(rest);
  return token;
}
