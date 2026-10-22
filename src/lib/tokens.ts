import "server-only";
import { createHash } from "node:crypto";
import type postgres from "postgres";
import { currentPeriod } from "./period";
import { fromBase64, KEY_ALGORITHM, suite, toBase64, type Token } from "./token-suite";

export const TOKENS_PER_PERIOD = 15;
export const MAX_TOKENS_PER_REQUEST = 5;

let keys: Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }> | undefined;

// TOKEN_PRIVATE_KEY is PKCS#8 and TOKEN_PUBLIC_KEY is SPKI, both base64 (see
// scripts/gen-token-keys.mjs).
function loadKeys() {
  keys ??= (async () => {
    const priv = process.env.TOKEN_PRIVATE_KEY;
    const pub = process.env.TOKEN_PUBLIC_KEY;
    if (!priv || !pub) throw new Error("TOKEN_PRIVATE_KEY and TOKEN_PUBLIC_KEY must be set");
    const [privateKey, publicKey] = await Promise.all([
      crypto.subtle.importKey("pkcs8", fromBase64(priv), KEY_ALGORITHM, false, ["sign"]),
      crypto.subtle.importKey("spki", fromBase64(pub), KEY_ALGORITHM, true, ["verify"]),
    ]);
    return { privateKey, publicKey };
  })();
  return keys;
}

export function publicKeyBase64(): string {
  const pub = process.env.TOKEN_PUBLIC_KEY;
  if (!pub) throw new Error("TOKEN_PUBLIC_KEY must be set");
  return pub;
}

export class TokenError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Signs blinded messages for a verified account, within its allowance for the
// period. Only the count is recorded; the server never sees the tokens themselves.
export async function issueTokens(sql: postgres.Sql, userId: string, blinded: string[]): Promise<string[]> {
  if (blinded.length === 0 || blinded.length > MAX_TOKENS_PER_REQUEST) {
    throw new TokenError(`Request between 1 and ${MAX_TOKENS_PER_REQUEST} tokens`, 400);
  }
  const period = currentPeriod();
  const rows = await sql`
    insert into token_issuance (user_id, semester, issued)
    values (${userId}, ${period}, ${blinded.length})
    on conflict (user_id, semester) do update set issued = token_issuance.issued + excluded.issued
    where token_issuance.issued + excluded.issued <= ${TOKENS_PER_PERIOD}
    returning issued`;
  if (rows.length === 0 || rows[0].issued > TOKENS_PER_PERIOD) {
    throw new TokenError("You have used all your review tokens for this period", 429);
  }
  const { privateKey } = await loadKeys();
  const s = suite();
  return Promise.all(blinded.map(async (b) => toBase64(await s.blindSign(privateKey, fromBase64(b)))));
}

// Checks a token's signature and marks it spent. Run inside the transaction that
// stores the content, so a failed insert does not burn the token.
export async function spendToken(sql: postgres.TransactionSql | postgres.Sql, token: Token): Promise<void> {
  const { publicKey } = await loadKeys();
  const msg = fromBase64(token.msg);
  let valid = false;
  try {
    valid = await suite().verify(publicKey, fromBase64(token.sig), msg);
  } catch {
    valid = false;
  }
  if (!valid) throw new TokenError("Invalid token", 403);
  const hash = createHash("sha256").update(msg).digest();
  const rows = await sql`insert into spent_tokens (token_hash) values (${hash}) on conflict do nothing returning 1`;
  if (rows.length === 0) throw new TokenError("Token already used", 409);
}
