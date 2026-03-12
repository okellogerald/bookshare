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

  // Derive public key from private JWK (same x, y but without d)
  const { d: _, ...publicJwk } = jwk;
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    ALGORITHM,
    true,
    ["verify"]
  );

  return { privateKey, publicKey };
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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

  // Build public JWK for the header (no private component)
  const { d: _, ...publicJwk } = privateJwk;

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
