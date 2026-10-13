-- AlterTable
ALTER TABLE "ShopifyToken" ADD COLUMN     "apiKeyEncrypted" TEXT,
ADD COLUMN     "apiSecretEncrypted" TEXT,
ALTER COLUMN "accessTokenEncrypted" DROP NOT NULL,
ALTER COLUMN "scope" DROP NOT NULL,
ALTER COLUMN "scope" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Store" ALTER COLUMN "shopifyDomain" DROP NOT NULL;
