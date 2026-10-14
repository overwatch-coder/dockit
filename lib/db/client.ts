import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const PRISMA_CLIENT_VERSION = 2;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion: number | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  // If a cached dev instance exists with matching schema version and storeAiRule, reuse it.
  // Otherwise (e.g. after schema changes or prisma generate), create a fresh instance.
  if (
    existing &&
    globalForPrisma.prismaVersion === PRISMA_CLIENT_VERSION &&
    "storeAiRule" in existing
  ) {
    return existing;
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION;
  }
  return client;
}

// Singleton across hot reloads in dev so we don't exhaust Neon connections.
export const prisma = getPrismaClient();
