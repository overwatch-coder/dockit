import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

const SHOP_DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function verifyShopDomain(shopDomain: string): boolean {
  return SHOP_DOMAIN_PATTERN.test(shopDomain);
}

export function buildAuthorizeUrl(shopDomain: string, state: string): string {
  const clientId = getEnv("SHOPIFY_API_KEY");
  const appUrl = getEnv("SHOPIFY_APP_URL");
  const scopes = getEnv("SHOPIFY_SCOPES");

  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", `${appUrl}/api/shopify/oauth/callback`);
  url.searchParams.set("state", state);
  return url.toString();
}

// Per Shopify's authorization code grant docs: remove `hmac`, sort the
// remaining params alphabetically, HMAC-SHA256 the resulting query string
// with the client secret, and timing-safe compare against the provided hmac.
export function verifyCallbackHmac(searchParams: URLSearchParams): boolean {
  const providedHmac = searchParams.get("hmac");
  if (!providedHmac) {
    return false;
  }

  const params = new URLSearchParams(searchParams);
  params.delete("hmac");

  const message = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const computedHmac = createHmac("sha256", getEnv("SHOPIFY_API_SECRET"))
    .update(message)
    .digest("hex");

  const provided = Buffer.from(providedHmac, "hex");
  const computed = Buffer.from(computedHmac, "hex");
  if (provided.length !== computed.length) {
    return false;
  }
  return timingSafeEqual(provided, computed);
}

type TokenExchangeResult =
  | { success: true; data: { accessToken: string; scope: string } }
  | { success: false; error: string };

export async function exchangeCodeForToken(
  shopDomain: string,
  code: string
): Promise<TokenExchangeResult> {
  try {
    const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: getEnv("SHOPIFY_API_KEY"),
        client_secret: getEnv("SHOPIFY_API_SECRET"),
        code,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Shopify token exchange failed with status ${response.status}` };
    }

    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("access_token" in body) ||
      !("scope" in body) ||
      typeof (body as Record<string, unknown>).access_token !== "string" ||
      typeof (body as Record<string, unknown>).scope !== "string"
    ) {
      return { success: false, error: "Shopify token exchange returned an unexpected response shape" };
    }

    return {
      success: true,
      data: {
        accessToken: (body as { access_token: string }).access_token,
        scope: (body as { scope: string }).scope,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Shopify token exchange request failed: ${message}` };
  }
}

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = Buffer.from(getEnv("SHOPIFY_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) {
    throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

// Packs iv + authTag + ciphertext into one base64 string so lib/db/stores.ts
// only ever handles an opaque encrypted blob, never plaintext or key material.
export function encryptAccessToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptAccessToken(encrypted: string): string {
  const packed = Buffer.from(encrypted, "base64");
  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

const STATE_COOKIE_NAME = "shopify_oauth_state";

export function generateOAuthState(accountId: string): { cookieValue: string; nonce: string } {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${nonce}.${accountId}`;
  const signature = createHmac("sha256", getEnv("SHOPIFY_API_SECRET")).update(payload).digest("hex");
  return { cookieValue: `${payload}.${signature}`, nonce };
}

export function verifyOAuthState(
  cookieValue: string,
  expectedNonce: string
): { valid: true; accountId: string } | { valid: false } {
  const parts = cookieValue.split(".");
  if (parts.length !== 3) {
    return { valid: false };
  }
  const [nonce, accountId, signature] = parts;

  const payload = `${nonce}.${accountId}`;
  const expectedSignature = createHmac("sha256", getEnv("SHOPIFY_API_SECRET")).update(payload).digest("hex");

  const provided = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { valid: false };
  }
  if (nonce !== expectedNonce) {
    return { valid: false };
  }
  return { valid: true, accountId };
}

export { STATE_COOKIE_NAME };
