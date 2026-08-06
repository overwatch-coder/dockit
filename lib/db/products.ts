import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import type { ShopifyImportedProduct } from "@/lib/shopify/products";
import type { ConflictSnapshot, Product } from "@/types/product";

type ProductRecord = {
  id: string;
  storeId: string;
  shopifyProductId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  price: { toString(): string };
  status: "DRAFT" | "ACTIVE";
  tags: string[];
  collectionId: string | null;
  collectionTitle: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isConflicted: boolean;
  // Prisma's Json? columns type as JsonValue | null at the client level —
  // narrowed to ConflictSnapshot | null here since this app is the only
  // writer of these columns (see syncProducts below) and always writes the
  // exact shape.
  conflictAppSnapshot: unknown;
  conflictShopifySnapshot: unknown;
  lastSyncedAt: Date | null;
  variants: {
    id: string;
    shopifyVariantId: string | null;
    optionName: string;
    price: { toString(): string };
    inventory: number;
  }[];
};

function toDomainProduct(product: ProductRecord): Product {
  return {
    id: product.id,
    storeId: product.storeId,
    shopifyProductId: product.shopifyProductId,
    title: product.title,
    description: product.description,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    price: product.price.toString(),
    status: product.status,
    tags: product.tags,
    collectionId: product.collectionId,
    collectionTitle: product.collectionTitle,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    isConflicted: product.isConflicted,
    conflictAppSnapshot: (product.conflictAppSnapshot as ConflictSnapshot | null) ?? null,
    conflictShopifySnapshot: (product.conflictShopifySnapshot as ConflictSnapshot | null) ?? null,
    lastSyncedAt: product.lastSyncedAt,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      shopifyVariantId: variant.shopifyVariantId,
      optionName: variant.optionName,
      price: variant.price.toString(),
      inventory: variant.inventory,
    })),
  };
}

// Read path for Unit 8's product list — accountId+storeId scoped per
// code-standards.md's tenant-isolation rule.
export async function getProductsForStore(accountId: string, storeId: string): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where: { accountId, storeId },
    // Unit 16, per explicit user request: most-recently-created product
    // first, so a newly created draft shows up at the top of the list
    // instead of needing to scroll/search for it.
    orderBy: { createdAt: "desc" },
    include: { variants: true },
  });
  return products.map(toDomainProduct);
}

export type GetProductsOptions = {
  page?: number;
  pageSize?: number | "all";
  search?: string;
  statusFilter?: "all" | "DRAFT" | "ACTIVE" | "CONFLICT";
  categoryFilter?: string;
};

export type PaginatedProductsResult = {
  products: Product[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number | "all";
};

export async function getPaginatedProductsForStore(
  accountId: string,
  storeId: string,
  options: GetProductsOptions = {}
): Promise<PaginatedProductsResult> {
  const where: {
    accountId: string;
    storeId: string;
    title?: { contains: string; mode: "insensitive" };
    isConflicted?: boolean;
    status?: "DRAFT" | "ACTIVE";
    collectionTitle?: string;
  } = {
    accountId,
    storeId,
  };

  if (options.search?.trim()) {
    where.title = { contains: options.search.trim(), mode: "insensitive" };
  }

  if (options.statusFilter === "CONFLICT") {
    where.isConflicted = true;
  } else if (options.statusFilter === "DRAFT") {
    where.status = "DRAFT";
    where.isConflicted = false;
  } else if (options.statusFilter === "ACTIVE") {
    where.status = "ACTIVE";
    where.isConflicted = false;
  }

  if (options.categoryFilter && options.categoryFilter !== "all") {
    where.collectionTitle = options.categoryFilter;
  }

  const requestedPage = Math.max(1, options.page ?? 1);
  const pageSizeOption = options.pageSize ?? 25;
  const take = pageSizeOption === "all" ? undefined : pageSizeOption;

  // Wrapped in one transaction (interactive form, since `skip` depends on
  // `page`, which depends on `totalCount`, so the two reads can't just be
  // fired as an independent array) so the count and the page of rows
  // reflect the same consistent snapshot even if a write lands in between —
  // same pattern markProductPushed already uses elsewhere in this file.
  const { totalCount, totalPages, page, records } = await prisma.$transaction(async (tx) => {
    const totalCount = await tx.product.count({ where });
    const totalPages = take ? Math.max(1, Math.ceil(totalCount / take)) : 1;
    const page = Math.min(requestedPage, totalPages);
    const skip = take ? (page - 1) * take : undefined;

    const records = await tx.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { variants: true },
      skip,
      take,
    });

    return { totalCount, totalPages, page, records };
  });

  return {
    products: records.map(toDomainProduct),
    totalCount,
    totalPages,
    page,
    pageSize: pageSizeOption,
  };
}

export async function getStoreCategories(accountId: string, storeId: string): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { accountId, storeId, collectionTitle: { not: null } },
    select: { collectionTitle: true },
    distinct: ["collectionTitle"],
  });
  return products.map((p) => p.collectionTitle!).filter(Boolean);
}

export type ProductSummary = {
  id: string;
  title: string;
  shopifyProductId: string | null;
  isConflicted: boolean;
};

// Lightweight projection for call sites that only need eligibility/labeling
// info across the store's *entire* catalog — PushAllDraftsButton's unsynced
// count, ProductTable's productTitles/pushableSelectedIds maps — not the
// full Product shape with variants/description/images that
// getProductsForStore fetches. Pulling the full shape on every /products
// page load defeated the point of getPaginatedProductsForStore above (the
// table itself only ever needs one page of full records; these call sites
// only need four scalar fields per product, for every product).
export async function getProductSummariesForStore(
  accountId: string,
  storeId: string
): Promise<ProductSummary[]> {
  return prisma.product.findMany({
    where: { accountId, storeId },
    select: { id: true, title: true, shopifyProductId: true, isConflicted: true },
  });
}

// Read path for Unit 9's product editor — accountId-scoped (not also
// storeId-scoped, since a product id already uniquely identifies its store
// within the account; the editor doesn't need to know which store ahead of
// fetching). Returns null rather than throwing on a missing/foreign id, so
// the page can render a real 404 instead of an error boundary.
export async function getProductById(accountId: string, productId: string): Promise<Product | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, accountId },
    include: { variants: true },
  });
  return product ? toDomainProduct(product) : null;
}

// Unit 10: a brand-new local-only draft — shopifyProductId stays null until
// a future push (Units 15-17) creates it on Shopify. Postgres treats each
// null as distinct for the storeId+shopifyProductId unique constraint, so
// multiple draft products in one store don't collide.
export async function createProduct(input: {
  accountId: string;
  storeId: string;
  title: string;
  description: string;
  price: string;
  status: "DRAFT" | "ACTIVE";
}): Promise<Product> {
  const product = await prisma.product.create({
    data: {
      accountId: input.accountId,
      storeId: input.storeId,
      shopifyProductId: null,
      title: input.title,
      description: input.description,
      price: input.price,
      status: input.status,
      lastEditedAt: new Date(),
    },
    include: { variants: true },
  });
  return toDomainProduct(product);
}

// Unit 10: edits a product's core fields (title, description, price,
// status). Account-scoped ownership check first (same pattern as
// getProductById) so a foreign/missing id returns null instead of silently
// updating nothing or throwing. Bumps lastEditedAt for conflict detection
// (context/architecture.md invariant 6).
export async function updateProduct(input: {
  accountId: string;
  productId: string;
  title: string;
  description: string;
  price: string;
  status: "DRAFT" | "ACTIVE";
  // Unit 13: manual collection/tag assignment. collectionId/collectionTitle
  // are written together (null clears the assignment); tags replaces the
  // whole array, matching how variants are fully reconciled on each save
  // rather than diffed field-by-field.
  collectionId?: string | null;
  collectionTitle?: string | null;
  tags?: string[];
  // Unit 14: Shopify's own SEO title/description, distinct from the main
  // title/description — manually editable and/or AI-suggested, same
  // "always write, default to null" convention as collectionId/collectionTitle.
  seoTitle?: string | null;
  seoDescription?: string | null;
}): Promise<Product | null> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!existing) {
    return null;
  }

  const product = await prisma.product.update({
    where: { id: input.productId },
    data: {
      title: input.title,
      description: input.description,
      price: input.price,
      status: input.status,
      collectionId: input.collectionId ?? null,
      collectionTitle: input.collectionTitle ?? null,
      tags: input.tags ?? [],
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      lastEditedAt: new Date(),
    },
    include: { variants: true },
  });
  return toDomainProduct(product);
}

// Unit 12: appends a newly uploaded draft image (Vercel Blob URL) to the
// product's gallery. imageUrl (the "primary/featured" image) only gets set
// here if it was still null — an existing Shopify-imported featured image
// is never silently replaced by a later upload. Bumps lastEditedAt, same
// conflict-detection convention as every other product write.
export async function addProductImage(input: {
  accountId: string;
  productId: string;
  url: string;
}): Promise<Product | null> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!existing) {
    return null;
  }

  const product = await prisma.product.update({
    where: { id: input.productId },
    data: {
      imageUrls: { push: input.url },
      imageUrl: existing.imageUrl ?? input.url,
      lastEditedAt: new Date(),
    },
    include: { variants: true },
  });
  return toDomainProduct(product);
}

// Unit 12: removes one image from the gallery (whether it's a draft Blob
// URL or a Shopify-imported one — the actual Blob file deletion, only
// applicable to the former, happens in lib/blob/products.ts before this is
// called). If the removed url was the featured imageUrl, the next
// remaining image (or null) takes its place.
export async function removeProductImage(input: {
  accountId: string;
  productId: string;
  url: string;
}): Promise<Product | null> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!existing) {
    return null;
  }

  const nextImageUrls = existing.imageUrls.filter((url) => url !== input.url);
  const nextImageUrl = existing.imageUrl === input.url ? (nextImageUrls[0] ?? null) : existing.imageUrl;

  const product = await prisma.product.update({
    where: { id: input.productId },
    data: {
      imageUrls: nextImageUrls,
      imageUrl: nextImageUrl,
      lastEditedAt: new Date(),
    },
    include: { variants: true },
  });
  return toDomainProduct(product);
}

// Unit 15: writes post-push state — deliberately does NOT touch
// lastEditedAt, unlike every other write in this file. lastEditedAt is the
// app-side-edit signal architecture.md invariant 6 uses for conflict
// detection; a push is the app asserting its current saved state onto
// Shopify, not a new edit, so bumping it here would make a
// just-pushed product look like it has unpushed changes again. Sets
// lastSyncedAt to now instead, same as importProducts, since the app and
// Shopify agree again immediately after a successful push. Not a reuse of
// updateProduct, which unconditionally bumps lastEditedAt and has no concept
// of shopifyProductId/shopifyVariantId writes.
//
// Unit 19: also clears isConflicted/both snapshots on every successful push,
// not just ones that came from the conflict-resolution dialog — correct in
// general (a successful push always makes the app's current record
// authoritative on Shopify, so any prior conflict is moot by definition),
// and it's what lets "Keep app version" resolve via the existing
// pushProduct/pushOneProduct path with no new job or server action.
export async function markProductPushed(input: {
  accountId: string;
  productId: string;
  shopifyProductId: string;
  imageUrl: string | null;
  imageUrls: string[];
  variants: { localVariantId: string; shopifyVariantId: string }[];
}): Promise<{ updated: boolean }> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!existing) {
    return { updated: false };
  }

  await prisma.$transaction([
    prisma.product.update({
      where: { id: input.productId },
      data: {
        shopifyProductId: input.shopifyProductId,
        imageUrl: input.imageUrl,
        imageUrls: input.imageUrls,
        lastSyncedAt: new Date(),
        isConflicted: false,
        conflictAppSnapshot: Prisma.JsonNull,
        conflictShopifySnapshot: Prisma.JsonNull,
      },
    }),
    ...input.variants.map((variant) =>
      prisma.variant.update({
        where: { id: variant.localVariantId },
        data: { shopifyVariantId: variant.shopifyVariantId },
      })
    ),
  ]);

  return { updated: true };
}

// Unit 16, corrected per explicit user feedback: eligibility for a bulk
// "push new products" action is whether a product has ever reached
// Shopify (shopifyProductId === null), not its local DRAFT/ACTIVE status —
// those are independent. A product marked DRAFT locally that was already
// pushed once is NOT re-pushed by this bulk action (that would silently
// overwrite whatever's live); republishing an already-synced product stays
// the single-product editor's explicit Republish button. Re-validates a
// caller-supplied selection (components/product-table.tsx's "Push
// selected" action) server-side — the client already pre-filters, but
// state could theoretically change between page load and click, so this is
// defense in depth, not the only filter. id-only wouldn't be enough here:
// storeId is needed for the batch push's Inngest event.
export async function getEligibleUnsyncedProducts(
  accountId: string,
  productIds: string[]
): Promise<{ id: string; storeId: string }[]> {
  return prisma.product.findMany({
    where: { accountId, id: { in: productIds }, shopifyProductId: null, isConflicted: false },
    select: { id: true, storeId: true },
  });
}

// Unit 16 follow-up: backs the "Push new products" trigger (no selection
// required) — every never-synced, non-conflicted product for the store,
// id-only since the caller (pushAllDrafts) already knows the storeId.
export async function getUnsyncedProductIdsForStore(accountId: string, storeId: string): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { accountId, storeId, shopifyProductId: null, isConflicted: false },
    select: { id: true },
  });
  return products.map((product) => product.id);
}

// Unit 16 follow-up: backs "sync this status change to Shopify now" — unlike
// getEligibleUnsyncedProducts, this is NOT limited to never-synced products,
// since the whole point is pushing a status change onto a product that may
// already be live on Shopify. Still excludes conflicted products, same
// safety margin as every other batch push.
export async function getProductsForStatusSync(
  accountId: string,
  productIds: string[]
): Promise<{ id: string; storeId: string }[]> {
  return prisma.product.findMany({
    where: { accountId, id: { in: productIds }, isConflicted: false },
    select: { id: true, storeId: true },
  });
}

// Unit 16 follow-up: bulk (or single-item, via a one-element array) status
// change from the products list — bumps lastEditedAt, same conflict-
// detection convention as every other product write (invariant 6).
export async function updateProductsStatus(input: {
  accountId: string;
  productIds: string[];
  status: "DRAFT" | "ACTIVE";
}): Promise<{ updatedCount: number }> {
  const result = await prisma.product.updateMany({
    where: { id: { in: input.productIds }, accountId: input.accountId },
    data: { status: input.status, lastEditedAt: new Date() },
  });
  return { updatedCount: result.count };
}

// Account-scoped, app-database-only delete — does not touch Shopify (no
// delete mutation exists yet, see lib/shopify/products.ts). Used for both a
// single product (array of one) and bulk delete from the product list, so
// there's one code path instead of two. Variants cascade-delete via the
// schema's onDelete: Cascade.
export async function deleteProducts(input: {
  accountId: string;
  productIds: string[];
}): Promise<{ deletedCount: number }> {
  const result = await prisma.product.deleteMany({
    where: { id: { in: input.productIds }, accountId: input.accountId },
  });
  return { deletedCount: result.count };
}

// Upserts each imported product keyed on the storeId+shopifyProductId
// compound unique (prisma/schema.prisma), so re-running the import (retries,
// or a future re-connect) is idempotent instead of duplicating rows. Variants
// are upserted the same way, keyed on productId+shopifyVariantId, as a
// separate pass once the product's id is known — nested compound-unique
// upserts under a parent upsert require the parent id at the type level
// before it exists, so this is clearer as two explicit steps. Only
// Shopify-sourced fields are touched — lastEditedAt and the draft/conflict
// fields belong to the app-side edit flow (Units 9/10, 18) and are left
// alone here.
export async function importProducts(input: {
  accountId: string;
  storeId: string;
  products: ShopifyImportedProduct[];
}): Promise<{ importedCount: number }> {
  const now = new Date();

  for (const product of input.products) {
    const savedProduct = await prisma.product.upsert({
      where: {
        storeId_shopifyProductId: {
          storeId: input.storeId,
          shopifyProductId: product.shopifyProductId,
        },
      },
      create: {
        accountId: input.accountId,
        storeId: input.storeId,
        shopifyProductId: product.shopifyProductId,
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls,
        price: product.price,
        status: product.status,
        tags: product.tags,
        collectionId: product.collectionId,
        collectionTitle: product.collectionTitle,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        lastSyncedAt: now,
      },
      update: {
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls,
        price: product.price,
        status: product.status,
        tags: product.tags,
        collectionId: product.collectionId,
        collectionTitle: product.collectionTitle,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        lastSyncedAt: now,
      },
    });

    for (const variant of product.variants) {
      await prisma.variant.upsert({
        where: {
          productId_shopifyVariantId: {
            productId: savedProduct.id,
            shopifyVariantId: variant.shopifyVariantId,
          },
        },
        create: {
          accountId: input.accountId,
          productId: savedProduct.id,
          shopifyVariantId: variant.shopifyVariantId,
          optionName: variant.optionName,
          price: variant.price,
          inventory: variant.inventory,
        },
        update: {
          optionName: variant.optionName,
          price: variant.price,
          inventory: variant.inventory,
        },
      });
    }
  }

  return { importedCount: input.products.length };
}

// Unit 17: the one piece of genuinely new business logic in the sync path —
// whether a product has an unpushed local edit that a sync must not
// silently discard (architecture.md invariant 6). Pure and independently
// testable. Strict `>` (not `>=`) so a same-instant lastEditedAt/lastSyncedAt
// pair (e.g. both stamped `new Date()` within the same millisecond) doesn't
// tip into an unwanted skip. No lastSyncedAt at all means the product has
// never been synced — nothing to compare against, so it's always safe to
// write.
export function shouldSkipSync(product: { lastEditedAt: Date; lastSyncedAt: Date | null }): boolean {
  if (!product.lastSyncedAt) return false;
  return product.lastEditedAt > product.lastSyncedAt;
}

// Unit 18: builds the "app side" half of a conflict snapshot from the
// currently-stored row — the exact ConflictSnapshot shape, so Unit 19's
// resolution UI can render conflictAppSnapshot/conflictShopifySnapshot
// symmetrically without knowing which side came from Prisma vs. Shopify's
// GraphQL response.
function toAppSnapshot(existing: {
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  price: { toString(): string };
  status: "DRAFT" | "ACTIVE";
  tags: string[];
  collectionId: string | null;
  collectionTitle: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: {
    shopifyVariantId: string | null;
    optionName: string;
    price: { toString(): string };
    inventory: number;
  }[];
}): ConflictSnapshot {
  return {
    title: existing.title,
    description: existing.description,
    imageUrl: existing.imageUrl,
    imageUrls: existing.imageUrls,
    price: existing.price.toString(),
    status: existing.status,
    tags: existing.tags,
    collectionId: existing.collectionId,
    collectionTitle: existing.collectionTitle,
    seoTitle: existing.seoTitle,
    seoDescription: existing.seoDescription,
    variants: existing.variants.map((variant) => ({
      shopifyVariantId: variant.shopifyVariantId,
      optionName: variant.optionName,
      price: variant.price.toString(),
      inventory: variant.inventory,
    })),
  };
}

// Unit 18/19: the Shopify-side half of a conflict snapshot — ShopifyImportedProduct
// already matches ConflictSnapshot's field set closely. Includes
// shopifyVariantId (Unit 19) so resolveConflictKeepShopify below can upsert
// variants by their real Shopify identity instead of losing the link.
function toShopifySnapshot(product: ShopifyImportedProduct): ConflictSnapshot {
  return {
    title: product.title,
    description: product.description,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    price: product.price,
    status: product.status,
    tags: product.tags,
    collectionId: product.collectionId,
    collectionTitle: product.collectionTitle,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    variants: product.variants.map((variant) => ({
      shopifyVariantId: variant.shopifyVariantId,
      optionName: variant.optionName,
      price: variant.price,
      inventory: variant.inventory,
    })),
  };
}

// Unit 17/18: the re-sync counterpart of importProducts, deliberately a
// separate function rather than a retrofit of it — importProducts is only
// ever called from the OAuth-connect flow, where every row is brand-new
// (nothing to compare lastEditedAt against yet), so bolting a skip-check
// onto it would be dead code for its only caller. This is also the natural
// home for per-product error isolation a full-catalog sync needs that a
// one-time import doesn't: one malformed Shopify record here shouldn't
// abort every other product's update the way a single throw would in
// importProducts' unconditional loop.
//
// Per product: if shouldSkipSync says there's an unpushed local edit, this
// is architecture.md invariant 6's case — never silently overwrite it.
// Unit 17 left it at that (skip, no write at all); Unit 18 upgrades this
// into the real behavior the invariant asks for: flag isConflicted, and
// store a snapshot of both versions (conflictAppSnapshot/
// conflictShopifySnapshot) so Unit 19 has something to show the owner. Only
// those three fields are written — title/description/price/etc. are left
// exactly as they are, so the app's unpushed edit is still what's live
// locally. If the product was already conflicted from a previous sync, this
// re-runs the same branch and refreshes conflictShopifySnapshot to the
// latest Shopify state, so a still-unresolved conflict doesn't go stale.
// Otherwise, write the same Shopify-sourced field set importProducts does.
export async function syncProducts(input: {
  accountId: string;
  storeId: string;
  products: ShopifyImportedProduct[];
}): Promise<{ syncedCount: number; conflictedCount: number; errorCount: number }> {
  const now = new Date();
  let syncedCount = 0;
  let conflictedCount = 0;
  let errorCount = 0;

  for (const product of input.products) {
    try {
      const existing = await prisma.product.findFirst({
        where: {
          accountId: input.accountId,
          storeId: input.storeId,
          shopifyProductId: product.shopifyProductId,
        },
        include: { variants: true },
      });
      if (existing && shouldSkipSync(existing)) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            isConflicted: true,
            conflictAppSnapshot: toAppSnapshot(existing),
            conflictShopifySnapshot: toShopifySnapshot(product),
          },
        });
        conflictedCount += 1;
        continue;
      }

      const savedProduct = await prisma.product.upsert({
        where: {
          storeId_shopifyProductId: {
            storeId: input.storeId,
            shopifyProductId: product.shopifyProductId,
          },
        },
        create: {
          accountId: input.accountId,
          storeId: input.storeId,
          shopifyProductId: product.shopifyProductId,
          title: product.title,
          description: product.description,
          imageUrl: product.imageUrl,
          imageUrls: product.imageUrls,
          price: product.price,
          status: product.status,
          tags: product.tags,
          collectionId: product.collectionId,
          collectionTitle: product.collectionTitle,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          lastSyncedAt: now,
        },
        update: {
          title: product.title,
          description: product.description,
          imageUrl: product.imageUrl,
          imageUrls: product.imageUrls,
          price: product.price,
          status: product.status,
          tags: product.tags,
          collectionId: product.collectionId,
          collectionTitle: product.collectionTitle,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          lastSyncedAt: now,
          // Reaching this branch means shouldSkipSync was false, i.e. no
          // unpushed local edit was found — clears a stale conflict flag
          // (and its now-irrelevant snapshots) left over from a conflict
          // that got resolved by some other path than Unit 19's dedicated
          // action, so isConflicted never drifts out of sync with reality.
          isConflicted: false,
          // Prisma's Json? columns require the sentinel Prisma.JsonNull, not
          // a plain `null`, to actually write a JSON null — a bare `null`
          // here is a TS-level type error since it's ambiguous with "leave
          // the field unset."
          conflictAppSnapshot: Prisma.JsonNull,
          conflictShopifySnapshot: Prisma.JsonNull,
        },
      });

      for (const variant of product.variants) {
        await prisma.variant.upsert({
          where: {
            productId_shopifyVariantId: {
              productId: savedProduct.id,
              shopifyVariantId: variant.shopifyVariantId,
            },
          },
          create: {
            accountId: input.accountId,
            productId: savedProduct.id,
            shopifyVariantId: variant.shopifyVariantId,
            optionName: variant.optionName,
            price: variant.price,
            inventory: variant.inventory,
          },
          update: {
            optionName: variant.optionName,
            price: variant.price,
            inventory: variant.inventory,
          },
        });
      }

      syncedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`syncProducts: failed for shopifyProductId ${product.shopifyProductId}: ${message}`);
      errorCount += 1;
    }
  }

  return { syncedCount, conflictedCount, errorCount };
}

// Unit 19: the "Keep Shopify version" conflict resolution — a pure local
// write, no Shopify call needed (invariant 1 stays satisfied), since
// conflictShopifySnapshot already holds everything required. The
// counterpart, "Keep app version," needs no dedicated function at all: it's
// just a normal push (pushProduct/pushOneProduct in lib/jobs/push.ts), and
// markProductPushed above already clears the conflict fields on success.
// Transactional (unlike syncProducts' per-item error isolation) since this
// is a single product — a partial resolution (product fields updated but a
// variant upsert failed, or vice versa) would be worse than a clean failure
// the owner can just retry.
export async function resolveConflictKeepShopify(input: {
  accountId: string;
  productId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const existing = await prisma.product.findFirst({
    where: { id: input.productId, accountId: input.accountId },
  });
  if (!existing) {
    return { success: false, error: "This product no longer exists." };
  }
  if (!existing.isConflicted || !existing.conflictShopifySnapshot) {
    return { success: false, error: "This product has no conflict to resolve." };
  }

  const snapshot = existing.conflictShopifySnapshot as unknown as ConflictSnapshot;
  const now = new Date();

  await prisma.$transaction([
    prisma.product.update({
      where: { id: existing.id },
      data: {
        title: snapshot.title,
        description: snapshot.description,
        imageUrl: snapshot.imageUrl,
        imageUrls: snapshot.imageUrls,
        price: snapshot.price,
        status: snapshot.status,
        tags: snapshot.tags,
        collectionId: snapshot.collectionId,
        collectionTitle: snapshot.collectionTitle,
        seoTitle: snapshot.seoTitle,
        seoDescription: snapshot.seoDescription,
        lastSyncedAt: now,
        isConflicted: false,
        conflictAppSnapshot: Prisma.JsonNull,
        conflictShopifySnapshot: Prisma.JsonNull,
      },
    }),
    // Every Shopify-snapshot variant has a shopifyVariantId (it came from
    // ShopifyImportedVariant, which always has one) — upserts by the real
    // productId_shopifyVariantId compound unique, same as syncProducts,
    // instead of the local id the app side may have used.
    ...snapshot.variants
      .filter((variant): variant is typeof variant & { shopifyVariantId: string } => variant.shopifyVariantId !== null)
      .map((variant) =>
        prisma.variant.upsert({
          where: {
            productId_shopifyVariantId: {
              productId: existing.id,
              shopifyVariantId: variant.shopifyVariantId,
            },
          },
          create: {
            accountId: input.accountId,
            productId: existing.id,
            shopifyVariantId: variant.shopifyVariantId,
            optionName: variant.optionName,
            price: variant.price,
            inventory: variant.inventory,
          },
          update: {
            optionName: variant.optionName,
            price: variant.price,
            inventory: variant.inventory,
          },
        })
      ),
  ]);

  return { success: true };
}
