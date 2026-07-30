import { prisma } from "@/lib/db/client";
import type { Store } from "@/types/store";

type StoreRecord = {
  id: string;
  shopifyDomain: string;
  name: string | null;
  connectedAt: Date | null;
};

function toDomainStore(store: StoreRecord): Store {
  return {
    id: store.id,
    shopifyDomain: store.shopifyDomain,
    name: store.name,
    connectedAt: store.connectedAt,
  };
}

export async function getStoresForAccount(accountId: string): Promise<Store[]> {
  const stores = await prisma.store.findMany({
    where: { accountId },
    orderBy: { createdAt: "asc" },
  });
  return stores.map(toDomainStore);
}

// shopifyDomain is globally unique (one Store row per Shopify store across
// every account), so this is a plain existence check, not account-scoped —
// used to reject reconnecting a domain that's already connected (to this
// account or any other) before ever starting a new OAuth round-trip.
export async function isShopDomainConnected(shopifyDomain: string): Promise<boolean> {
  const existing = await prisma.store.findFirst({
    where: { shopifyDomain: { equals: shopifyDomain, mode: "insensitive" } },
    select: { id: true },
  });
  return existing !== null;
}

export async function createStoreWithToken(input: {
  accountId: string;
  shopifyDomain: string;
  name: string | null;
  accessTokenEncrypted: string;
  scope: string;
}): Promise<Store> {
  const store = await prisma.store.upsert({
    where: { shopifyDomain: input.shopifyDomain },
    create: {
      accountId: input.accountId,
      shopifyDomain: input.shopifyDomain,
      name: input.name,
      connectedAt: new Date(),
      token: {
        create: {
          accountId: input.accountId,
          accessTokenEncrypted: input.accessTokenEncrypted,
          scope: input.scope,
        },
      },
    },
    update: {
      name: input.name,
      connectedAt: new Date(),
      token: {
        upsert: {
          create: {
            accountId: input.accountId,
            accessTokenEncrypted: input.accessTokenEncrypted,
            scope: input.scope,
          },
          update: {
            accessTokenEncrypted: input.accessTokenEncrypted,
            scope: input.scope,
          },
        },
      },
    },
  });

  return toDomainStore(store);
}

// Scoped lookup used by the import/sync jobs to get what they need to call
// Shopify (lib/shopify/oauth.ts decrypts the token; this function never
// does). Returns null if the store doesn't belong to the account or has no
// token yet, so callers can't accidentally act on another account's store.
export async function getStoreToken(
  accountId: string,
  storeId: string
): Promise<{ shopifyDomain: string; accessTokenEncrypted: string } | null> {
  const store = await prisma.store.findFirst({
    where: { id: storeId, accountId },
    include: { token: true },
  });
  if (!store?.token) {
    return null;
  }
  return { shopifyDomain: store.shopifyDomain, accessTokenEncrypted: store.token.accessTokenEncrypted };
}

// Uses deleteMany (not delete) so the accountId scope is enforced by the
// query itself, not a separate ownership check the caller could forget.
// ShopifyToken/Product/Job rows for this store cascade-delete via the
// schema's onDelete: Cascade.
export async function deleteStore(input: {
  accountId: string;
  storeId: string;
}): Promise<{ deleted: boolean }> {
  const result = await prisma.store.deleteMany({
    where: { id: input.storeId, accountId: input.accountId },
  });
  return { deleted: result.count > 0 };
}
