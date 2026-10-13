import { postShopifyGraphQL } from "./client";

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

// Deletes a product permanently from Shopify via GraphQL. Called from
// lib/jobs/delete.ts's background job, gated client-side by
// components/delete-from-shopify-dialog.tsx's confirmation — never inline
// from a server action (architecture.md invariant 4).
export async function deleteProductFromShopify(
  shopDomain: string,
  accessToken: string,
  shopifyProductId: string
): Promise<DeleteProductResult> {
  try {
    const result = await postShopifyGraphQL<RawDeleteResponse>(
      shopDomain,
      accessToken,
      PRODUCT_DELETE_MUTATION,
      { input: { id: toGid(shopifyProductId) } }
    );

    if (!result.ok) {
      return result.reason === "http-error"
        ? { success: false, error: `Shopify request failed with status ${result.status}` }
        : { success: false, error: `Shopify request failed: ${result.message}` };
    }

    const body = result.body;

    // Same principle as lib/shopify/push.ts's postGraphQL: top-level
    // GraphQL `errors` are protocol-level failures never meant for
    // end-user display — log the real message, return a generic one.
    if (body.errors?.length) {
      const technicalMessage = body.errors.map((e) => e.message).join("; ");
      console.error(`Shopify GraphQL error (${shopDomain}): ${technicalMessage}`);
      return { success: false, error: "Shopify rejected the delete request. Try again in a moment." };
    }

    const deleteResult = body.data?.productDelete;
    if (!deleteResult) {
      return { success: false, error: "Shopify response had no data" };
    }
    if (deleteResult.userErrors.length > 0) {
      return { success: false, error: deleteResult.userErrors.map((e) => e.message).join("; ") };
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
