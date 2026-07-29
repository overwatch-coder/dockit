import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Account } from "@/types/account";

type AccountRecord = {
  id: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomainAccount(account: AccountRecord): Account {
  return {
    id: account.id,
    name: account.name,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export async function getOrCreateAccountForClerkUser(
  clerkUserId: string
): Promise<Account> {
  const existing = await prisma.accountUser.findUnique({
    where: { clerkUserId },
    include: { account: true },
  });

  if (existing) {
    return toDomainAccount(existing.account);
  }

  try {
    const account = await prisma.account.create({
      data: {
        users: {
          create: { clerkUserId, role: "OWNER" },
        },
      },
    });
    return toDomainAccount(account);
  } catch (error) {
    // A concurrent first request for the same Clerk user can race this
    // create and hit AccountUser.clerkUserId's unique constraint. Re-fetch
    // once instead of failing the request.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const retried = await prisma.accountUser.findUnique({
        where: { clerkUserId },
        include: { account: true },
      });
      if (retried) {
        return toDomainAccount(retried.account);
      }
    }
    throw error;
  }
}
