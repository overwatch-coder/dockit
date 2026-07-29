import { prisma } from "@/lib/db/client";
import type { Store } from "@/types/store";

type StoreRecord = {
  id: string;
  shopifyDomain: string;
  connectedAt: Date | null;
};

function toDomainStore(store: StoreRecord): Store {
  return {
    id: store.id,
    shopifyDomain: store.shopifyDomain,
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

export async function createStoreWithToken(input: {
  accountId: string;
  shopifyDomain: string;
  accessTokenEncrypted: string;
  scope: string;
}): Promise<Store> {
  const store = await prisma.store.upsert({
    where: { shopifyDomain: input.shopifyDomain },
    create: {
      accountId: input.accountId,
      shopifyDomain: input.shopifyDomain,
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
