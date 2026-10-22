// Prints a fresh token-signing key pair as environment variables.
// Rotate it each period by replacing both values.
import { RSABSSA } from "@cloudflare/blindrsa-ts";

const { privateKey, publicKey } = await RSABSSA.SHA384.generateKey({
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
});
const b64 = (buf) => Buffer.from(buf).toString("base64");
console.log(`TOKEN_PRIVATE_KEY=${b64(await crypto.subtle.exportKey("pkcs8", privateKey))}`);
console.log(`TOKEN_PUBLIC_KEY=${b64(await crypto.subtle.exportKey("spki", publicKey))}`);
