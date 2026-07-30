"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { deleteStore, isShopDomainConnected } from "@/lib/db/stores";
import {
  buildAuthorizeUrl,
  checkShopExists,
  generateOAuthState,
  normalizeShopDomainInput,
  STATE_COOKIE_NAME,
  verifyShopDomain,
} from "@/lib/shopify/oauth";

const shopDomainSchema = z
  .string()
  .trim()
  .min(1, "Enter your store's domain")
  .transform(normalizeShopDomainInput);

export type ConnectStoreState = { error: string } | undefined;

export async function connectStore(
  _prevState: ConnectStoreState,
  formData: FormData
): Promise<ConnectStoreState> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const parsed = shopDomainSchema.safeParse(formData.get("shopDomain"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter your store's domain" };
  }
  const shopDomain = parsed.data;

  if (!verifyShopDomain(shopDomain)) {
    return { error: "Enter a valid myshopify.com store domain" };
  }

  if (await isShopDomainConnected(shopDomain)) {
    return { error: "This store is already connected." };
  }

  const exists = await checkShopExists(shopDomain);
  if (!exists) {
    return { error: `We couldn't find a Shopify store at ${shopDomain}. Check the domain and try again.` };
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

export async function disconnectStore(storeId: string): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  const { deleted } = await deleteStore({ accountId: account.id, storeId });
  if (!deleted) {
    return { error: "That store is already disconnected." };
  }

  revalidatePath("/dashboard");
}
