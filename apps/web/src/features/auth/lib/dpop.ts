/**
 * DPoP (Demonstration of Proof-of-Possession) — RFC 9449
 *
 * Implements sender-constrained access tokens for the Web app's API calls.
 * When DPoP is active, a stolen access token is useless without the private
 * key that was used to bind it during the token exchange.
 *
 * Lifecycle:
 * 1. During `/api/auth/callback`, a fresh ECDSA P-256 keypair is generated.
 * 2. A DPoP proof is attached to the token exchange request, so Hydra can
 *    bind the access token to the public key (via the `cnf.jkt` claim).
 * 3. The private key JWK is stored in the encrypted session cookie.
 * 4. For each API call, `apiFetch` imports the private key, creates a fresh
 *    DPoP proof (with jti, htm, htu, iat, ath), and sends it alongside
 *    the `Authorization: DPoP <token>` header.
 *
 * The proof is single-use: `jti` (random UUID) prevents replay, `iat`
 * prevents old proofs, and `ath` (access token hash) binds proof to token.
 *
 * @see `api-client.ts` — where DPoP proofs are attached to API requests
 * @see `/api/auth/callback` — where the keypair is generated and stored
 */
import * as client from "openid-client";

const ALGORITHM: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };
const SIGN_ALGORITHM: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };

/**
 * Generate a new DPoP keypair using openid-client.
 * The key must be extractable so we can serialize the private key to JWK.
 */
export async function generateDPoPKeyPair(): Promise<CryptoKeyPair> {
  return client.randomDPoPKeyPair("ES256", { extractable: true });
}

/**
 * Export the private key from a CryptoKeyPair as a JWK.
 * The JWK contains both private (d) and public (x, y) components.
 */
export async function exportPrivateKeyJwk(
  keyPair: CryptoKeyPair
): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", keyPair.privateKey);
}

/**
 * Strip the private key component (d) from a JWK, leaving only the public
 * key (kty, crv, x, y). Used in the DPoP proof header so the verifier can
 * confirm possession without seeing the private key.
 */
function getPublicJwk(jwk: JsonWebKey): JsonWebKey {
  return {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y,
    ext: true,
  };
}

/**
 * Re-import a keypair from a serialized private key JWK.
 */
async function importKeyPairFromJwk(
  jwk: JsonWebKey
): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    ALGORITHM,
    true,
    ["sign"]
  );

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    getPublicJwk(jwk),
    ALGORITHM,
    true,
    ["verify"]
  );

  return { privateKey, publicKey };
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
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

/**
 * Check if a JWT access token has a DPoP binding confirmation (cnf.jkt claim).
 * When present, the resource server requires a matching DPoP proof for every
 * request. When absent, the token should be sent as a plain Bearer token.
 */
export function tokenHasDpopBinding(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(fromBase64Url(parts[1])) as {
      cnf?: { jkt?: unknown };
    };
    return typeof payload.cnf?.jkt === "string" && payload.cnf.jkt.length > 0;
  } catch {
    return false;
  }
}

/**
 * Create a DPoP proof JWT for resource server requests (RFC 9449).
 * This is used when the Next.js BFF proxies requests to NestJS API.
 */
export async function createDPoPProof(
  privateJwk: JsonWebKey,
  httpMethod: string,
  httpUri: string,
  accessToken: string
): Promise<string> {
  const { privateKey } = await importKeyPairFromJwk(privateJwk);

  // Build public JWK for the header without private-key-only metadata.
  const publicJwk = getPublicJwk(privateJwk);

  // Compute access token hash (ath): base64url(SHA-256(access_token))
  const tokenBytes = new TextEncoder().encode(accessToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBytes);
  const ath = toBase64Url(hashBuffer);

  // Strip query/fragment from URI per RFC 9449 Section 4.2
  const url = new URL(httpUri);
  const htu = `${url.protocol}//${url.host}${url.pathname}`;

  // Build JWT header
  const header = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: publicJwk,
  };

  // Build JWT payload
  const payload = {
    jti: crypto.randomUUID(),
    htm: httpMethod.toUpperCase(),
    htu,
    iat: Math.floor(Date.now() / 1000),
    ath,
  };

  // Encode and sign
  const encodedHeader = toBase64Url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signatureBuffer = await crypto.subtle.sign(
    SIGN_ALGORITHM,
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  // ECDSA signature from Web Crypto is in IEEE P1363 format (r || s),
  // which is what JWS ES256 expects — no conversion needed.
  const signature = toBase64Url(signatureBuffer);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
