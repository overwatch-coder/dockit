import { prisma } from "@/lib/db/client";
import {
  decryptAccessToken,
  decryptSecret,
  encryptAccessToken,
  encryptSecret,
  maskAccessToken,
} from "@/lib/shopify/oauth";
import type { Store } from "@/types/store";

type StoreRecord = {
  id: string;
  shopifyDomain: string | null;
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

export async function createStore(input: { accountId: string; name: string }): Promise<Store> {
  const store = await prisma.store.create({
    data: {
      accountId: input.accountId,
      name: input.name,
      shopifyDomain: null,
      connectedAt: null,
    },
  });
  return toDomainStore(store);
}

// Checks if a shopifyDomain is already connected to another store.
export async function isShopDomainConnected(shopifyDomain: string, excludeStoreId?: string): Promise<boolean> {
  const existing = await prisma.store.findFirst({
    where: {
      shopifyDomain: { equals: shopifyDomain, mode: "insensitive" },
      connectedAt: { not: null },
      ...(excludeStoreId ? { id: { not: excludeStoreId } } : {}),
    },
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

export type StoreCredentialsView = {
  shopDomain: string;
  isConnected: boolean;
  hasOAuthAppCredentials: boolean;
  tokenPreview: string | null;
  createdAt: string;
  updatedAt?: string;
};

export async function getStoreCredentials(
  accountId: string,
  storeId: string
): Promise<StoreCredentialsView | null> {
  const store = await prisma.store.findFirst({
    where: { id: storeId, accountId },
    include: { token: true },
  });
  if (!store) return null;

  const token = store.token;
  const isConnected = Boolean(store.connectedAt && token?.accessTokenEncrypted);
  const hasOAuthAppCredentials = Boolean(token?.apiKeyEncrypted && token?.apiSecretEncrypted);
  let tokenPreview: string | null = null;
  if (token?.accessTokenEncrypted) {
    try {
      const decrypted = decryptAccessToken(token.accessTokenEncrypted);
      tokenPreview = maskAccessToken(decrypted);
    } catch {
      tokenPreview = "shpat_••••••••";
    }
  }

  return {
    shopDomain: store.shopifyDomain ?? "",
    isConnected,
    hasOAuthAppCredentials,
    tokenPreview,
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
  };
}

export async function saveStoreAppCredentials(input: {
  accountId: string;
  storeId: string;
  shopDomain: string;
  apiKey: string;
  apiSecret: string;
}): Promise<void> {
  const store = await prisma.store.findFirst({
    where: { id: input.storeId, accountId: input.accountId },
  });
  if (!store) {
    throw new Error("Store not found");
  }

  const apiKeyEncrypted = encryptSecret(input.apiKey.trim());
  const apiSecretEncrypted = encryptSecret(input.apiSecret.trim());

  await prisma.$transaction([
    prisma.store.update({
      where: { id: input.storeId },
      data: { shopifyDomain: input.shopDomain },
    }),
    prisma.shopifyToken.upsert({
      where: { storeId: input.storeId },
      create: {
        accountId: input.accountId,
        storeId: input.storeId,
        apiKeyEncrypted,
        apiSecretEncrypted,
      },
      update: {
        apiKeyEncrypted,
        apiSecretEncrypted,
      },
    }),
  ]);
}

export async function saveStoreAccessToken(input: {
  accountId: string;
  storeId: string;
  shopDomain: string;
  accessToken: string;
  name?: string | null;
  scope?: string;
  tokenType?: string;
}): Promise<void> {
  const store = await prisma.store.findFirst({
    where: { id: input.storeId, accountId: input.accountId },
  });
  if (!store) {
    throw new Error("Store not found");
  }

  const accessTokenEncrypted = encryptAccessToken(input.accessToken.trim());

  await prisma.$transaction([
    prisma.store.update({
      where: { id: input.storeId },
      data: {
        shopifyDomain: input.shopDomain,
        connectedAt: new Date(),
        ...(input.name ? { name: input.name } : {}),
      },
    }),
    prisma.shopifyToken.upsert({
      where: { storeId: input.storeId },
      create: {
        accountId: input.accountId,
        storeId: input.storeId,
        accessTokenEncrypted,
        scope: input.scope ?? "",
        tokenType: input.tokenType ?? "bearer",
      },
      update: {
        accessTokenEncrypted,
        scope: input.scope ?? "",
        tokenType: input.tokenType ?? "bearer",
      },
    }),
  ]);
}

export async function disconnectStoreShopify(input: {
  accountId: string;
  storeId: string;
}): Promise<void> {
  await prisma.$transaction([
    prisma.store.updateMany({
      where: { id: input.storeId, accountId: input.accountId },
      data: { connectedAt: null },
    }),
    prisma.shopifyToken.deleteMany({
      where: { storeId: input.storeId, accountId: input.accountId },
    }),
  ]);
}

export async function markStoreDisconnected(storeId: string): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: { connectedAt: null },
  });
}

export async function getStoreAppCredentials(
  accountId: string,
  storeId: string
): Promise<{ shopDomain: string; apiKey: string; apiSecret: string } | null> {
  const store = await prisma.store.findFirst({
    where: { id: storeId, accountId },
    include: { token: true },
  });
  if (!store?.shopifyDomain || !store.token?.apiKeyEncrypted || !store.token?.apiSecretEncrypted) {
    return null;
  }
  try {
    const apiKey = decryptSecret(store.token.apiKeyEncrypted);
    const apiSecret = decryptSecret(store.token.apiSecretEncrypted);
    return { shopDomain: store.shopifyDomain, apiKey, apiSecret };
  } catch {
    return null;
  }
}

// Scoped lookup used by import/sync jobs to get domain & token to call Shopify.
export async function getStoreToken(
  accountId: string,
  storeId: string
): Promise<{ shopifyDomain: string; accessTokenEncrypted: string } | null> {
  const store = await prisma.store.findFirst({
    where: { id: storeId, accountId },
    include: { token: true },
  });
  if (!store?.shopifyDomain || !store.token?.accessTokenEncrypted || !store.connectedAt) {
    return null;
  }
  return { shopifyDomain: store.shopifyDomain, accessTokenEncrypted: store.token.accessTokenEncrypted };
}

export function getActiveStoreForAccount(stores: Store[], cookieStoreId: string | null): Store | null {
  if (cookieStoreId) {
    const matched = stores.find((store) => store.id === cookieStoreId);
    if (matched) {
      return matched;
    }
  }
  return stores[0] ?? null;
}

export async function deleteStore(input: {
  accountId: string;
  storeId: string;
}): Promise<{ deleted: boolean }> {
  const result = await prisma.store.deleteMany({
    where: { id: input.storeId, accountId: input.accountId },
  });
  return { deleted: result.count > 0 };
}
