-- CreateTable
CREATE TABLE "StoreAiRule" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "brandTone" TEXT,
    "titleRule" TEXT,
    "descriptionRule" TEXT,
    "tagsRule" TEXT,
    "seoRule" TEXT,
    "customInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreAiRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreAiRule_storeId_key" ON "StoreAiRule"("storeId");

-- CreateIndex
CREATE INDEX "StoreAiRule_accountId_idx" ON "StoreAiRule"("accountId");

-- AddForeignKey
ALTER TABLE "StoreAiRule" ADD CONSTRAINT "StoreAiRule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
