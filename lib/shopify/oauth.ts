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

// Accepts a bare subdomain ("my-store"), a full myshopify.com domain
// ("my-store.myshopify.com"), or a full admin URL ("https://my-store.myshopify.com/admin")
// and normalizes all three down to just the domain, lowercased. Shopify shop
// domains are case-insensitive and Shopify always echoes the canonical
// lowercase form back in its own redirects — lowercasing here too keeps our
// stored/queried domain consistent with that, so a differently-cased repeat
// of an already-connected domain still gets caught by isShopDomainConnected
// instead of slipping through to a real (and redundant) OAuth round-trip. A
// store's custom domain never serves /admin (only *.myshopify.com does), so
// a normalized custom domain is still rejected by verifyShopDomain — callers
// must check that separately rather than assume this always returns a
// connectable domain.
export function normalizeShopDomainInput(value: string): string {
  const withoutProtocol = value.trim().replace(/^https?:\/\//i, "");
  const domainOnly = withoutProtocol.split(/[/?#]/)[0].toLowerCase();
  return domainOnly.includes(".") ? domainOnly : `${domainOnly}.myshopify.com`;
}

// Shopify doesn't document an official "does this shop exist" endpoint, so
// this is a heuristic: a nonexistent shop's /admin returns 404, an existing
// one redirects (to login or the OAuth grant screen). Used only to avoid
// sending the browser to Shopify's own dead-end 404 page for a typo'd
// domain — it fails open (treats an inconclusive/network-error result as
// "exists") since the real OAuth handshake still validates everything that
// actually matters (HMAC, state, shop format).
export async function checkShopExists(shopDomain: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${shopDomain}/admin`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    return response.status !== 404;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`checkShopExists: request to ${shopDomain} failed, assuming it exists: ${message}`);
    return true;
  }
}

export function buildAuthorizeUrl(
  shopDomain: string,
  state: string,
  clientIdOverride?: string
): string {
  const clientId = clientIdOverride ?? getEnv("SHOPIFY_API_KEY");
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
export function verifyCallbackHmac(
  searchParams: URLSearchParams,
  secretOverride?: string
): boolean {
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

  const secret = secretOverride ?? getEnv("SHOPIFY_API_SECRET");
  const computedHmac = createHmac("sha256", secret)
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
  code: string,
  credentialsOverride?: { apiKey: string; apiSecret: string }
): Promise<TokenExchangeResult> {
  try {
    const clientId = credentialsOverride?.apiKey ?? getEnv("SHOPIFY_API_KEY");
    const clientSecret = credentialsOverride?.apiSecret ?? getEnv("SHOPIFY_API_SECRET");
    const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
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

export function maskAccessToken(token: string): string {
  if (!token) return "";
  const prefix = token.startsWith("shpat_") ? "shpat_" : token.slice(0, Math.min(6, token.length));
  const suffix = token.length >= 4 ? token.slice(-4) : "";
  return `${prefix}••••••••${suffix}`;
}

export const encryptSecret = encryptAccessToken;
export const decryptSecret = decryptAccessToken;

const STATE_COOKIE_NAME = "shopify_oauth_state";

export function generateOAuthState(
  accountId: string,
  storeId?: string
): { cookieValue: string; nonce: string } {
  const nonce = randomBytes(16).toString("hex");
  const payload = storeId ? `${nonce}.${accountId}.${storeId}` : `${nonce}.${accountId}`;
  const signature = createHmac("sha256", getEnv("SHOPIFY_API_SECRET")).update(payload).digest("hex");
  return { cookieValue: `${payload}.${signature}`, nonce };
}

export function verifyOAuthState(
  cookieValue: string,
  expectedNonce: string
): { valid: true; accountId: string; storeId?: string } | { valid: false } {
  const parts = cookieValue.split(".");
  if (parts.length !== 3 && parts.length !== 4) {
    return { valid: false };
  }

  let nonce: string;
  let accountId: string;
  let storeId: string | undefined;
  let signature: string;
  let payload: string;

  if (parts.length === 4) {
    [nonce, accountId, storeId, signature] = parts;
    payload = `${nonce}.${accountId}.${storeId}`;
  } else {
    [nonce, accountId, signature] = parts;
    payload = `${nonce}.${accountId}`;
  }

  const expectedSignature = createHmac("sha256", getEnv("SHOPIFY_API_SECRET")).update(payload).digest("hex");

  const provided = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { valid: false };
  }
  if (nonce !== expectedNonce) {
    return { valid: false };
  }
  return { valid: true, accountId, storeId };
}

export { STATE_COOKIE_NAME };
