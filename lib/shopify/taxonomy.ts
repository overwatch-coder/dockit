import { toBareId } from "./products";
import { postShopifyGraphQL } from "./client";
import rawCategories from "./category-taxonomy.json";

export type ShopifyTaxonomyCategory = {
  id: string;
  name: string;
  // Shopify's own ready-made breadcrumb string (e.g. "Animals & Pet
  // Supplies > Pet Supplies > Dog Beds") — no manual breadcrumb
  // construction needed, verified live against shopify.dev before writing
  // this query (ai-workflow-rules.md #15).
  fullName: string;
};

export interface LocalTaxonomyEntry {
  readonly id: string;
  readonly full_name: string;
}

export const categoryTaxonomy = rawCategories as readonly LocalTaxonomyEntry[];

export interface TaxonomyResolveInput {
  readonly productType?: string | null | undefined;
  readonly title?: string | null | undefined;
  readonly description?: string | null | undefined;
  readonly tags?: readonly string[] | undefined;
}

let cachedEntries: ShopifyTaxonomyCategory[] | null = null;

export function getShopifyTaxonomyEntries(): ShopifyTaxonomyCategory[] {
  if (cachedEntries) return cachedEntries;

  const entries: ShopifyTaxonomyCategory[] = [];
  const seenIds = new Set<string>();

  for (const entry of categoryTaxonomy) {
    const rawCode = entry.id.trim().split("/").pop();
    const fullName = entry.full_name.trim();
    if (!rawCode || !fullName) continue;

    const id = `gid://shopify/TaxonomyCategory/${rawCode}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      const name = fullName.split(">").pop()?.trim() || fullName;
      entries.push({ id, name, fullName });
    }
  }

  cachedEntries = entries;
  return entries;
}

export function normalizeCategoryLabel(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/['"'\u2019]/g, "")
    .replace(/\s*>\s*/g, " > ")
    .replace(/\s+/g, " ");
}

export function isTaxonomyId(value: string | null | undefined): boolean {
  const normalized = (value || "").trim().toLowerCase();
  return (
    normalized.startsWith("gid://shopify/taxonomycategory/") ||
    normalized.startsWith("gid://shopify/producttaxonomynode/") ||
    /^[a-z]{2,4}(?:-\d+)+$/.test(normalized)
  );
}

function rankTaxonomyMatches(
  matches: ShopifyTaxonomyCategory[],
  contextText: string,
): ShopifyTaxonomyCategory[] {
  const normCtx = contextText.toLowerCase();
  const hasBaby =
    /\b(baby|babies|child|children|kids|toddler|toddlers|infant|infants|newborn)\b/.test(normCtx);
  const hasMaternity = /\b(maternity|pregnancy|pregnant|nursing)\b/.test(normCtx);
  const hasPet =
    /\b(pet|pets|dog|dogs|cat|cats|animal|animals|puppy|puppies|kitten|kittens)\b/.test(normCtx);

  const penalty = (cat: ShopifyTaxonomyCategory): number => {
    const full = cat.fullName.toLowerCase();
    let p = 0;
    if (
      (full.includes("baby") ||
        full.includes("child") ||
        full.includes("kids") ||
        full.includes("toddler") ||
        full.includes("infant")) &&
      !hasBaby
    ) {
      p += 100;
    }
    if (full.includes("maternity") && !hasMaternity) {
      p += 100;
    }
    if ((full.includes("pet") || full.includes("animals & pet")) && !hasPet) {
      p += 100;
    }
    return p;
  };

  return [...matches].sort((a, b) => {
    const pA = penalty(a);
    const pB = penalty(b);
    if (pA !== pB) return pA - pB;
    const aApparel = a.fullName.startsWith("Apparel & Accessories") ? 1 : 0;
    const bApparel = b.fullName.startsWith("Apparel & Accessories") ? 1 : 0;
    if (aApparel !== bApparel) return bApparel - aApparel;
    return b.fullName.split(">").length - a.fullName.split(">").length;
  });
}

/**
 * Resolves a product's official Shopify taxonomy category based on productType,
 * title, and tags from local Shopify category taxonomy definitions.
 */
export function resolveProductTaxonomyCategory(
  input: TaxonomyResolveInput,
): ShopifyTaxonomyCategory | null {
  const entries = getShopifyTaxonomyEntries();
  const candidates: string[] = [];
  const contextText = [input.title, input.productType, ...(input.tags ?? [])]
    .filter(Boolean)
    .join(" ");

  if (input.productType) {
    const raw = input.productType.trim();
    candidates.push(raw);
    const stripped = raw
      .replace(/\b(men|mens|women|womens|kids|children|unisex|boys|girls|adults|ladies)\b/gi, "")
      .trim();
    if (stripped && stripped !== raw) {
      candidates.push(stripped);
    }
  }

  if (input.title) {
    candidates.push(input.title.trim());
  }

  // 1. Exact full-path or exact leaf name match across candidates
  for (const candidate of candidates) {
    const norm = normalizeCategoryLabel(candidate);
    if (!norm) continue;

    const exactFull = entries.find((e) => normalizeCategoryLabel(e.fullName) === norm);
    if (exactFull) return exactFull;

    const exactLeaf = entries.filter((e) => normalizeCategoryLabel(e.name) === norm);
    if (exactLeaf.length > 0) {
      return rankTaxonomyMatches(exactLeaf, contextText)[0] ?? null;
    }
  }

  // 2. Token-based leaf match
  for (const candidate of candidates) {
    const words = normalizeCategoryLabel(candidate)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3);

    for (const word of words) {
      const leafMatch = entries.filter((e) => {
        const normName = normalizeCategoryLabel(e.name);
        return (
          normName === word ||
          normName === `${word}s` ||
          normName === `${word}es` ||
          `${normName}s` === word ||
          `${normName}es` === word
        );
      });
      if (leafMatch.length > 0) {
        return rankTaxonomyMatches(leafMatch, contextText)[0] ?? null;
      }
    }
  }

  // 3. Fallback to tags if available
  if (input.tags && input.tags.length > 0) {
    for (const tag of input.tags) {
      const norm = normalizeCategoryLabel(tag);
      if (!norm || norm.length < 3) continue;

      const leafMatch = entries.filter((e) => {
        const normName = normalizeCategoryLabel(e.name);
        return (
          normName === norm ||
          normName === `${norm}s` ||
          normName === `${norm}es` ||
          `${normName}s` === norm ||
          `${normName}es` === norm
        );
      });
      if (leafMatch.length > 0) {
        return rankTaxonomyMatches(leafMatch, contextText)[0] ?? null;
      }
    }
  }

  return null;
}

type TaxonomySearchResult =
  | { success: true; data: ShopifyTaxonomyCategory[] }
  | { success: false; error: string };

type RawTaxonomyCategoryNode = { id: string; name: string; fullName: string; isLeaf: boolean };

type RawTaxonomyResponse = {
  data?: {
    taxonomy?: {
      categories?: {
        edges: { node: RawTaxonomyCategoryNode }[];
      };
    };
  };
};

const TAXONOMY_SEARCH_QUERY = `
  query SearchTaxonomyCategories($search: String!, $first: Int!) {
    taxonomy {
      categories(search: $search, first: $first) {
        edges {
          node {
            id
            name
            fullName
            isLeaf
          }
        }
      }
    }
  }
`;

// Live Shopify Taxonomy search via GraphQL
export async function searchTaxonomyCategories(
  shopDomain: string,
  accessToken: string,
  query: string,
  limit = 20
): Promise<TaxonomySearchResult> {
  try {
    const result = await postShopifyGraphQL<RawTaxonomyResponse>(
      shopDomain,
      accessToken,
      TAXONOMY_SEARCH_QUERY,
      { search: query, first: Math.min(limit * 10, 200) }
    );

    if (!result.ok) {
      return result.reason === "http-error"
        ? { success: false, error: `Taxonomy search failed with status ${result.status}` }
        : { success: false, error: `Taxonomy search request failed: ${result.message}` };
    }

    const edges = result.body.data?.taxonomy?.categories?.edges;
    if (!edges) {
      return { success: false, error: "Taxonomy search returned an unexpected response shape" };
    }

    return {
      success: true,
      data: edges
        .filter(({ node }) => node.isLeaf)
        .slice(0, limit)
        .map(({ node }) => ({ id: toBareId(node.id), name: node.name, fullName: node.fullName })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Taxonomy search request failed: ${message}` };
  }
}

