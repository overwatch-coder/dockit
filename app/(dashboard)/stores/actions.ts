"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";
import { deleteStore, getStoresForAccount, isShopDomainConnected } from "@/lib/db/stores";
import { ACTIVE_STORE_COOKIE_NAME } from "@/lib/active-store-cookie";
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

// Unit 22 follow-up: setActiveStore/disconnectStore's storeId params were
// only ever validated by *membership* (does this account actually own a
// store with this id), never by *format* — a non-string-shaped value would
// have reached that membership check (or deleteStore's Prisma call) as
// whatever raw value a direct request supplied. Same
// "validate every server action input with a schema" rule as
// app/(dashboard)/products/actions.ts's identical idSchema.
const idSchema = z.string().trim().min(1, "Missing id.");

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

// Unit 21: sets the active-store cookie after validating storeId actually
// belongs to the caller's account — never trusts a client-supplied id
// on its own, same defensive stance as every other store-scoped query in
// this codebase (architecture.md's Invariants #3).
export async function setActiveStore(storeId: string): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(storeId).success) {
    return { error: "Invalid store." };
  }

  const stores = await getStoresForAccount(account.id);
  if (!stores.some((store) => store.id === storeId)) {
    return { error: "That store isn't connected to this account." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_STORE_COOKIE_NAME, storeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  revalidatePath("/", "layout");
}

export async function disconnectStore(storeId: string): Promise<{ error: string } | undefined> {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  if (!idSchema.safeParse(storeId).success) {
    return { error: "Invalid store." };
  }

  const { deleted } = await deleteStore({ accountId: account.id, storeId });
  if (!deleted) {
    return { error: "That store is already disconnected." };
  }

  // If the store just removed was the active one, clear the cookie so the
  // next read falls through to getActiveStoreForAccount's own fallback
  // (first remaining store, or null) instead of pointing at a dead id.
  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_STORE_COOKIE_NAME)?.value === storeId) {
    cookieStore.delete(ACTIVE_STORE_COOKIE_NAME);
  }

  // Layout-wide (not just "/dashboard") — the store switcher (and the store
  // list it renders) lives in the shared sidebar, so removal needs to
  // refresh regardless of which page it was triggered from (Unit 21).
  revalidatePath("/", "layout");
}
