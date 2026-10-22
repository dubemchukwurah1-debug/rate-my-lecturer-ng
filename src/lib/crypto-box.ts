import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for report details. Layout: 12-byte IV | 16-byte tag | ciphertext.
function key(): Buffer {
  const b64 = process.env.REPORT_ENCRYPTION_KEY;
  const k = b64 ? Buffer.from(b64, "base64") : null;
  if (!k || k.length !== 32) throw new Error("REPORT_ENCRYPTION_KEY must be 32 bytes, base64");
  return k;
}

export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decrypt(box: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key(), box.subarray(0, 12));
  decipher.setAuthTag(box.subarray(12, 28));
  return Buffer.concat([decipher.update(box.subarray(28)), decipher.final()]).toString("utf8");
}
