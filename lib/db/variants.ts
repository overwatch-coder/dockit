import { prisma } from "@/lib/db/client";
import type { Variant } from "@/types/product";

type VariantRecord = {
  id: string;
  shopifyVariantId: string | null;
  optionName: string;
  price: { toString(): string };
  inventory: number;
};

function toDomainVariant(variant: VariantRecord): Variant {
  return {
    id: variant.id,
    shopifyVariantId: variant.shopifyVariantId,
    optionName: variant.optionName,
    price: variant.price.toString(),
    inventory: variant.inventory,
  };
}

// Unit 11: adds a local-only variant (shopifyVariantId stays null until a
// future push, same draft convention as Unit 10's createProduct) to an
// existing product draft. Verifies the product belongs to the account first
// — a Variant's own accountId is set from that check, not inherited
// implicitly — and bumps the parent product's lastEditedAt for conflict
// detection (context/architecture.md invariant 6), same as updateProduct.
export async function addVariant(input: {
  accountId: string;
  productId: string;
  optionName: string;
  price: string;
  inventory: number;
}): Promise<Variant | null> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!product) {
    return null;
  }

  const [variant] = await prisma.$transaction([
    prisma.variant.create({
      data: {
        accountId: input.accountId,
        productId: input.productId,
        shopifyVariantId: null,
        optionName: input.optionName,
        price: input.price,
        inventory: input.inventory,
      },
    }),
    prisma.product.update({ where: { id: input.productId }, data: { lastEditedAt: new Date() } }),
  ]);
  return toDomainVariant(variant);
}

// Account-scoped ownership check first (same pattern as updateProduct) so a
// foreign/missing variant id returns null instead of updating nothing or
// throwing.
// productId is returned alongside the variant (not part of the Variant
// domain type itself) purely so the caller can revalidate the specific
// product page's path.
export async function updateVariant(input: {
  accountId: string;
  variantId: string;
  optionName: string;
  price: string;
  inventory: number;
}): Promise<{ variant: Variant; productId: string } | null> {
  const existing = await prisma.variant.findFirst({
    where: { id: input.variantId, accountId: input.accountId },
  });
  if (!existing) {
    return null;
  }

  const [variant] = await prisma.$transaction([
    prisma.variant.update({
      where: { id: input.variantId },
      data: { optionName: input.optionName, price: input.price, inventory: input.inventory },
    }),
    prisma.product.update({ where: { id: existing.productId }, data: { lastEditedAt: new Date() } }),
  ]);
  return { variant: toDomainVariant(variant), productId: existing.productId };
}

export async function deleteVariant(input: {
  accountId: string;
  variantId: string;
}): Promise<{ deleted: boolean; productId?: string }> {
  const existing = await prisma.variant.findFirst({
    where: { id: input.variantId, accountId: input.accountId },
  });
  if (!existing) {
    return { deleted: false };
  }

  await prisma.$transaction([
    prisma.variant.delete({ where: { id: input.variantId } }),
    prisma.product.update({ where: { id: existing.productId }, data: { lastEditedAt: new Date() } }),
  ]);
  return { deleted: true, productId: existing.productId };
}
