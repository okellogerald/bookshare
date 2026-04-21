/**
 * Known Accounts Cookie — Auth-Portal
 *
 * Tracks accounts the user has previously authenticated into from this browser,
 * so the Auth-Portal can offer a Google-style account chooser when the user
 * lands on Hydra's login challenge with `prompt=select_account` (or when the
 * user explicitly clicks "Switch account" from a client).
 *
 * This cookie is NOT a session. It stores only enough data to render chooser
 * chips (email + display name + subject id) and is scoped to the Auth-Portal
 * origin. The active Kratos session remains authoritative — picking an entry
 * from the chooser routes through a fresh Kratos login flow with the email
 * prefilled, forcing re-entry of the password.
 *
 * Storage: AES-256-GCM encrypted JSON payload, keyed by `SESSION_SECRET` and
 * a dedicated HKDF salt (`bookshare-known-accounts-v1`) for domain separation
 * from organization-session and Hydra-challenge cookies.
 *
 * Invariants:
 * - Max 5 entries (LRU-evicted by `lastUsedAt`)
 * - Sorted newest-first on read
 * - Silent recovery on corrupt/legacy payloads (treated as empty list)
 *
 * @see `/oauth/login/route.ts` — upserts on successful auth, reads on select_account
 * @see `/chooser/page.tsx` — renders the chooser UI from this cookie
 */
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const KNOWN_ACCOUNTS_COOKIE = "bookshare_known_accounts";
const KNOWN_ACCOUNTS_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 days
const KNOWN_ACCOUNTS_MAX_ENTRIES = 5;

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT = new TextEncoder().encode("bookshare-known-accounts-v1");
const INFO = new TextEncoder().encode("aes-256-gcm");

let cachedKey: CryptoKey | null = null;

export interface KnownAccount {
  /** Kratos identity ID — stable subject for this user. */
  sub: string;
  /** Lowercased email address shown as the primary label. */
  email: string;
  /** Display name (first + last) shown above the email. Optional. */
  name?: string;
  /** ISO timestamp of the last successful authentication for this account. */
  lastUsedAt: string;
}

interface KnownAccountsPayload {
  v: 1;
  accounts: KnownAccount[];
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: KNOWN_ACCOUNTS_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }
  return secret;
}

async function deriveKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
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
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function encryptPayload(payload: KnownAccountsPayload): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return `${toBase64Url(iv.buffer)}.${toBase64Url(ciphertext)}`;
}

async function decryptPayload(value: string): Promise<KnownAccountsPayload | null> {
  try {
    const key = await deriveKey();
    const [ivPart, ciphertextPart] = value.split(".");
    if (!ivPart || !ciphertextPart) {
      return null;
    }
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(ciphertextPart)
    );
    const decoded = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    return isValidPayload(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function isValidPayload(value: unknown): value is KnownAccountsPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as { v?: unknown; accounts?: unknown };
  if (payload.v !== 1) return false;
  if (!Array.isArray(payload.accounts)) return false;
  return payload.accounts.every(isValidAccount);
}

function isValidAccount(value: unknown): value is KnownAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as {
    sub?: unknown;
    email?: unknown;
    name?: unknown;
    lastUsedAt?: unknown;
  };
  return (
    typeof account.sub === "string" &&
    account.sub.length > 0 &&
    typeof account.email === "string" &&
    account.email.length > 0 &&
    typeof account.lastUsedAt === "string" &&
    (account.name === undefined || typeof account.name === "string")
  );
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Read known accounts from the request's cookies. Returns a freshly-sorted
 * list (newest `lastUsedAt` first). Invalid or missing cookies resolve to
 * an empty list without throwing.
 */
export async function getKnownAccounts(): Promise<KnownAccount[]> {
  const store = await cookies();
  const raw = store.get(KNOWN_ACCOUNTS_COOKIE)?.value;
  if (!raw) return [];

  const payload = await decryptPayload(raw);
  if (!payload) return [];

  return [...payload.accounts].sort((a, b) =>
    b.lastUsedAt.localeCompare(a.lastUsedAt)
  );
}

/**
 * Insert or update an account in the known-accounts list. Identity is keyed
 * by `sub` (Kratos identity id). When the list exceeds the max size, the
 * least-recently-used entry is dropped.
 *
 * Writes the refreshed cookie to the provided response. No-op if the provided
 * account is incomplete.
 */
export async function upsertKnownAccount(
  response: NextResponse,
  input: { sub: string; email: string; name?: string }
): Promise<void> {
  const sub = input.sub.trim();
  const email = normalizeEmail(input.email);
  if (!sub || !email) return;

  const existing = await getKnownAccounts();
  const now = new Date().toISOString();
  const nextEntry: KnownAccount = {
    sub,
    email,
    name: normalizeName(input.name),
    lastUsedAt: now,
  };

  const deduped = existing.filter((account) => account.sub !== sub);
  deduped.unshift(nextEntry);

  const trimmed = deduped
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, KNOWN_ACCOUNTS_MAX_ENTRIES);

  const encrypted = await encryptPayload({ v: 1, accounts: trimmed });
  response.cookies.set(KNOWN_ACCOUNTS_COOKIE, encrypted, COOKIE_OPTIONS);
}

/**
 * Remove a single account from the known-accounts list (identified by `sub`).
 * If the list becomes empty, the cookie is deleted. No-op if the account is
 * not present.
 */
export async function removeKnownAccount(
  response: NextResponse,
  sub: string
): Promise<void> {
  const trimmedSub = sub.trim();
  if (!trimmedSub) return;

  const existing = await getKnownAccounts();
  const filtered = existing.filter((account) => account.sub !== trimmedSub);
  if (filtered.length === existing.length) return;

  if (filtered.length === 0) {
    response.cookies.delete(KNOWN_ACCOUNTS_COOKIE);
    return;
  }

  const encrypted = await encryptPayload({ v: 1, accounts: filtered });
  response.cookies.set(KNOWN_ACCOUNTS_COOKIE, encrypted, COOKIE_OPTIONS);
}

/** Delete the entire known-accounts cookie. */
export function clearKnownAccounts(response: NextResponse): void {
  response.cookies.delete(KNOWN_ACCOUNTS_COOKIE);
}
