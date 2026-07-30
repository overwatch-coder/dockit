-- CreateIndex
CREATE UNIQUE INDEX "Product_storeId_shopifyProductId_key" ON "Product"("storeId", "shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_productId_shopifyVariantId_key" ON "Variant"("productId", "shopifyVariantId");
