const ADMIN_API_VERSION = "2026-07";

type ShopNameResult = { success: true; data: { name: string } } | { success: false; error: string };

// Best-effort lookup of the shop's display name, used only to give the store
// switcher a readable label instead of the raw *.myshopify.com domain. A
// failure here never blocks connecting the store (see the callback route),
// so it returns a typed result rather than throwing.
export async function fetchShopName(
  shopDomain: string,
  accessToken: string
): Promise<ShopNameResult> {
  try {
    const response = await fetch(`https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: "{ shop { name } }" }),
    });

    if (!response.ok) {
      return { success: false, error: `Shop name lookup failed with status ${response.status}` };
    }

    const body: unknown = await response.json();
    const name =
      typeof body === "object" &&
      body !== null &&
      "data" in body &&
      typeof (body as Record<string, unknown>).data === "object" &&
      (body as Record<string, unknown>).data !== null
        ? ((body as { data: { shop?: { name?: unknown } } }).data.shop?.name ?? null)
        : null;

    if (typeof name !== "string") {
      return { success: false, error: "Shop name lookup returned an unexpected response shape" };
    }

    return { success: true, data: { name } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Shop name lookup request failed: ${message}` };
  }
}
