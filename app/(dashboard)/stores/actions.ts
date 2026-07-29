"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { buildAuthorizeUrl, generateOAuthState, STATE_COOKIE_NAME, verifyShopDomain } from "@/lib/shopify/oauth";

const shopDomainSchema = z
  .string()
  .trim()
  .min(1, "Enter your store's domain")
  .transform((value) => (value.includes(".") ? value : `${value}.myshopify.com`));

export async function connectStore(formData: FormData): Promise<never> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const shopDomain = shopDomainSchema.parse(formData.get("shopDomain"));
  if (!verifyShopDomain(shopDomain)) {
    throw new Error("Enter a valid myshopify.com store domain");
  }

  const { cookieValue, nonce } = generateOAuthState(account.id);
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  redirect(buildAuthorizeUrl(shopDomain, nonce));
}
