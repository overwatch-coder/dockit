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

// Unit 11 follow-up, per explicit user request: variant add/edit/remove is
// staged client-side (components/variant-list.tsx) and only reaches the
// database when the product editor's Save button is pressed — so instead of
// three separate add/update/delete server calls firing per row interaction,
// updateProduct (app/(dashboard)/products/actions.ts) calls this once per
// save with the full current variant list and the DB is reconciled to match
// it: ids that already exist get updated, ids that don't (the client's
// temporary ids for newly added rows) get created as local-only variants
// (shopifyVariantId stays null, same draft convention as createProduct),
// and any existing variant whose id is missing from the submitted list —
// because the row was removed in the UI — gets deleted. All three effects
// run in one transaction.
export async function syncProductVariants(input: {
  accountId: string;
  productId: string;
  variants: { id: string; optionName: string; price: string; inventory: number }[];
}): Promise<{ variants: Variant[] } | null> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
    include: { variants: true },
  });
  if (!product) {
    return null;
  }

  const existingIds = new Set(product.variants.map((variant) => variant.id));
  const submittedIds = new Set(input.variants.map((variant) => variant.id));

  const toDelete = product.variants.filter((variant) => !submittedIds.has(variant.id));
  const toUpdate = input.variants.filter((variant) => existingIds.has(variant.id));
  const toCreate = input.variants.filter((variant) => !existingIds.has(variant.id));

  await prisma.$transaction([
    prisma.variant.deleteMany({ where: { id: { in: toDelete.map((variant) => variant.id) } } }),
    ...toUpdate.map((variant) =>
      prisma.variant.update({
        where: { id: variant.id },
        data: { optionName: variant.optionName, price: variant.price, inventory: variant.inventory },
      })
    ),
    ...toCreate.map((variant) =>
      prisma.variant.create({
        data: {
          accountId: input.accountId,
          productId: input.productId,
          shopifyVariantId: null,
          optionName: variant.optionName,
          price: variant.price,
          inventory: variant.inventory,
        },
      })
    ),
  ]);

  const freshVariants = await prisma.variant.findMany({ where: { productId: input.productId } });
  return { variants: freshVariants.map(toDomainVariant) };
}
