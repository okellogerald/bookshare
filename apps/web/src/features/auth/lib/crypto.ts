/**
 * Cookie Encryption — AES-256-GCM with HKDF Key Derivation
 *
 * All auth cookies (session data, access tokens, OIDC transaction state) are
 * encrypted before being stored in the browser using this module. This ensures:
 *
 * - Cookies are unreadable even if exfiltrated (e.g., via XSS)
 * - Cookie contents cannot be tampered with (GCM provides authentication)
 * - Each encryption uses a fresh random IV, so identical plaintext produces
 *   different ciphertext
 *
 * Key derivation: SESSION_SECRET → HKDF-SHA256 → AES-256 key. The salt and
 * info parameters are fixed strings that act as domain separation — changing
 * them would invalidate all existing sessions.
 *
 * Wire format: `base64url(iv).base64url(ciphertext+tag)`
 *
 * @see `session.ts` — uses encrypt/decrypt for session and token cookies
 * @see `@bookshare/shared` OIDC utilities — uses encrypt for transaction cookies
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM

/** Fixed salt for HKDF — changing this invalidates all existing sessions. */
const SALT = new TextEncoder().encode("bookshare-session-v1");
/** Fixed info parameter for HKDF — provides domain separation. */
const INFO = new TextEncoder().encode("aes-256-gcm");

/** Module-level cache — the key is derived once per process lifetime. */
let cachedKey: CryptoKey | null = null;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not configured. Set it in .env and restart the web container."
    );
  }
  return secret;
}

/**
 * Derive a 256-bit AES-GCM key from SESSION_SECRET using HKDF-SHA256.
 * The result is cached for the process lifetime since the secret doesn't change.
 */
async function deriveKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const secret = getSecret();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"]
  );

  cachedKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: SALT, info: INFO },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );

  return cachedKey;
}

function toBase64Url(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypt a string with AES-256-GCM. Returns `base64url(iv).base64url(ciphertext)`.
 * A fresh random 12-byte IV is generated for each call.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  return `${toBase64Url(iv.buffer)}.${toBase64Url(ciphertext)}`;
}

/**
 * Decrypt a string previously encrypted with `encrypt()`.
 * Expects the `base64url(iv).base64url(ciphertext)` wire format.
 * Throws on corrupted or tampered input (GCM authentication failure).
 */
export async function decrypt(encrypted: string): Promise<string> {
  const key = await deriveKey();
  const parts = encrypted.split(".");

  if (parts.length !== 2) {
    throw new Error("Invalid encrypted format");
  }

  const iv = fromBase64Url(parts[0]);
  const ciphertext = fromBase64Url(parts[1]);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
