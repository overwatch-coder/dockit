import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { getStoreAppCredentials } from "@/lib/db/stores";
import {
  buildAuthorizeUrl,
  generateOAuthState,
  normalizeShopDomainInput,
  STATE_COOKIE_NAME,
  verifyShopDomain,
} from "@/lib/shopify/oauth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const account = await getOrCreateAccountForClerkUser(userId);
  const storeId = request.nextUrl.searchParams.get("storeId");
  const shopQuery = request.nextUrl.searchParams.get("shopDomain") ?? "";

  if (!storeId) {
    const errorUrl = new URL("/settings", request.url);
    errorUrl.searchParams.set("oauthError", "missing_store");
    return NextResponse.redirect(errorUrl);
  }

  const credentials = await getStoreAppCredentials(account.id, storeId);
  if (!credentials || !credentials.apiKey || !credentials.apiSecret) {
    const errorUrl = new URL("/settings", request.url);
    errorUrl.searchParams.set("oauthError", "credentials_missing");
    return NextResponse.redirect(errorUrl);
  }

  const targetDomain = normalizeShopDomainInput(shopQuery || credentials.shopDomain);
  if (!verifyShopDomain(targetDomain)) {
    const errorUrl = new URL("/settings", request.url);
    errorUrl.searchParams.set("oauthError", "invalid_shop");
    return NextResponse.redirect(errorUrl);
  }

  const { cookieValue, nonce } = generateOAuthState(account.id, storeId);
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  const authorizeUrl = buildAuthorizeUrl(targetDomain, nonce, credentials.apiKey);
  return NextResponse.redirect(authorizeUrl);
}
