import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createStoreWithToken, isShopDomainConnected } from "@/lib/db/stores";
import {
  encryptAccessToken,
  exchangeCodeForToken,
  STATE_COOKIE_NAME,
  verifyCallbackHmac,
  verifyOAuthState,
  verifyShopDomain,
} from "@/lib/shopify/oauth";
import { fetchShopName } from "@/lib/shopify/shop";

function errorRedirect(request: NextRequest, message: string): NextResponse {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("storeError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!shop || !code || !state) {
    return errorRedirect(request, "Missing required OAuth callback parameters");
  }

  if (!verifyShopDomain(shop)) {
    return errorRedirect(request, "Invalid shop domain in OAuth callback");
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE_NAME)?.value;
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!stateCookie) {
    return errorRedirect(request, "Missing OAuth state, please try connecting again");
  }

  const stateResult = verifyOAuthState(stateCookie, state);
  if (!stateResult.valid) {
    return errorRedirect(request, "OAuth state mismatch, please try connecting again");
  }

  if (!verifyCallbackHmac(searchParams)) {
    return errorRedirect(request, "OAuth signature verification failed");
  }

  // Defense in depth — connectStore already rejects a reconnect attempt
  // before redirecting to Shopify, but a stale/replayed authorize link could
  // still land here directly.
  if (await isShopDomainConnected(shop)) {
    return errorRedirect(request, "This store is already connected.");
  }

  const tokenResult = await exchangeCodeForToken(shop, code);
  if (!tokenResult.success) {
    return errorRedirect(request, tokenResult.error);
  }

  // Best-effort — a failed name lookup shouldn't block the connection itself,
  // the store switcher just falls back to the domain (lib/shopify/shop.ts).
  const shopNameResult = await fetchShopName(shop, tokenResult.data.accessToken);
  if (!shopNameResult.success) {
    console.error(`OAuth callback: shop name lookup failed for ${shop}: ${shopNameResult.error}`);
  }

  await createStoreWithToken({
    accountId: stateResult.accountId,
    shopifyDomain: shop,
    name: shopNameResult.success ? shopNameResult.data.name : null,
    accessTokenEncrypted: encryptAccessToken(tokenResult.data.accessToken),
    scope: tokenResult.data.scope,
  });

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
