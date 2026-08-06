const ADMIN_API_VERSION = "2026-07";

export type DeleteProductResult = { success: true } | { success: false; error: string };

function toGid(bareId: string): string {
  return bareId.startsWith("gid://") ? bareId : `gid://shopify/Product/${bareId}`;
}

const PRODUCT_DELETE_MUTATION = `
  mutation DeleteProduct($input: ProductDeleteInput!) {
    productDelete(input: $input) {
      deletedProductId
      userErrors { field message }
    }
  }
`;

type RawDeleteResponse = {
  data?: {
    productDelete: {
      deletedProductId: string | null;
      userErrors: { field: string[] | null; message: string }[];
    };
  };
  errors?: { message: string }[];
};

// Unit 16 follow-up, per explicit user request: the app could previously
// only remove a product from its own database — Shopify itself was never
// touched (lib/db/products.ts's deleteProducts, which stays unchanged and
// remains the fast "just stop tracking this locally" action). This is the
// first real Shopify delete mutation in the app; only ever called from
// lib/jobs/delete.ts's background job, gated client-side by
// components/delete-from-shopify-dialog.tsx's type-the-product-name
// confirmation — never inline from a server action (architecture.md
// invariant 4).
export async function deleteProductFromShopify(
  shopDomain: string,
  accessToken: string,
  shopifyProductId: string
): Promise<DeleteProductResult> {
  try {
    const response = await fetch(`https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: PRODUCT_DELETE_MUTATION,
        variables: { input: { id: toGid(shopifyProductId) } },
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Shopify request failed with status ${response.status}` };
    }

    const body = (await response.json()) as RawDeleteResponse;

    // Same principle as lib/shopify/push.ts's postGraphQL: top-level
    // GraphQL `errors` are protocol-level failures never meant for
    // end-user display — log the real message, return a generic one.
    if (body.errors?.length) {
      const technicalMessage = body.errors.map((e) => e.message).join("; ");
      console.error(`Shopify GraphQL error (${shopDomain}): ${technicalMessage}`);
      return { success: false, error: "Shopify rejected the delete request. Try again in a moment." };
    }

    const result = body.data?.productDelete;
    if (!result) {
      return { success: false, error: "Shopify response had no data" };
    }
    if (result.userErrors.length > 0) {
      return { success: false, error: result.userErrors.map((e) => e.message).join("; ") };
    }

    // A null deletedProductId with no userErrors typically means the
    // product was already gone on Shopify's side (e.g. deleted manually,
    // or a retried job) — treated as success, not failure, since the end
    // state the caller wanted (no product on Shopify) is already true.
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Shopify request failed: ${message}` };
  }
}
