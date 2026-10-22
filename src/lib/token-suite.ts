import { RSABSSA } from "@cloudflare/blindrsa-ts";

// RFC 9474 blind RSA (RSABSSA-SHA384-PSS-Randomized), shared by browser and server.
export const suite = () => RSABSSA.SHA384.PSS.Randomized();

export const KEY_ALGORITHM = { name: "RSA-PSS", hash: "SHA-384" } as const;

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// A spendable token: the prepared message and the unblinded signature over it.
export interface Token {
  msg: string;
  sig: string;
}
