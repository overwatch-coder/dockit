// Shared low-level transport for every Shopify Admin GraphQL API call in
// this codebase (Unit 22: retry-with-backoff for Shopify rate limits, per
// code-standards.md's "Rate limit handling... lives inside lib/shopify/,
// not duplicated"). Every exported function elsewhere in lib/shopify/ that
// talks to Shopify's GraphQL endpoint routes its fetch through here instead
// of calling `fetch` directly, so this is the one place retry/backoff
// logic lives.
//
// Deliberately owns *only* the transport: building the request, sending
// it, and retrying it on a Shopify rate-limit signal. It has no opinion on
// response *shape* — GraphQL `errors`, `userErrors`, "what does a missing
// `data` field mean for this particular query" all stay exactly where they
// already were, one file per concern, so this refactor doesn't change a
// single existing caller-facing error message.
//
// Rate limiting, verified live against shopify.dev's rate-limits docs and
// Shopify's developer community (ai-workflow-rules.md #15 — not guessed):
// cost-based throttling can surface as a plain HTTP 429, or as an HTTP 200
// whose GraphQL `errors` array contains a `{ message: "Throttled" }` entry
// (sometimes with `extensions.code === "THROTTLED"`), with a top-level
// `extensions.cost.throttleStatus` giving the exact point budget
// (maximumAvailable/currentlyAvailable/restoreRate). Shopify's own
// documented guidance is a flat one-second backoff; this uses the precise
// throttleStatus math when it's present (how many points short, divided by
// the restore rate) and falls back to that same one-second floor with
// exponential growth otherwise (e.g. a bare 429 with no GraphQL body).

const ADMIN_API_VERSION = "2026-07";

// Assumption, flagged per ai-workflow-rules.md #14 — not specified in any
// spec doc: up to 4 retries (5 attempts total) before giving up and handing
// the still-throttled response back to the caller completely unchanged,
// exactly as if this file didn't retry at all. Callers' existing error
// messages/shape-handling are what surface after that, unmodified.
const MAX_RETRY_ATTEMPTS = 4;
const MIN_BACKOFF_MS = 1000; // Shopify's own documented minimum backoff.
const MAX_BACKOFF_MS = 8000;

export type ShopifyRequestResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; reason: "http-error"; status: number }
  | { ok: false; reason: "network-error"; message: string };

type ShopifyGraphQLEnvelope = {
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: {
    cost?: {
      requestedQueryCost?: number;
      throttleStatus?: { maximumAvailable: number; currentlyAvailable: number; restoreRate: number };
    };
  };
};

function isThrottledEnvelope(body: unknown): body is ShopifyGraphQLEnvelope {
  const envelope = body as ShopifyGraphQLEnvelope | null;
  return (
    envelope?.errors?.some(
      (e) => e.extensions?.code === "THROTTLED" || e.message === "Throttled"
    ) ?? false
  );
}

function backoffDelayMs(attempt: number, envelope: ShopifyGraphQLEnvelope | null, retryAfterHeader: string | null): number {
  const throttleStatus = envelope?.extensions?.cost?.throttleStatus;
  const requestedCost = envelope?.extensions?.cost?.requestedQueryCost;
  if (throttleStatus && typeof requestedCost === "number") {
    const shortfall = requestedCost - throttleStatus.currentlyAvailable;
    if (shortfall > 0 && throttleStatus.restoreRate > 0) {
      return Math.max(MIN_BACKOFF_MS, Math.ceil((shortfall / throttleStatus.restoreRate) * 1000));
    }
  }
  if (retryAfterHeader !== null) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(MIN_BACKOFF_MS, seconds * 1000);
    }
  }
  return Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function postShopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<ShopifyRequestResult<T>> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(`https://${shopDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { ok: false, reason: "network-error", message };
    }

    // Hard, resource-based rate limit — HTTP-level, may or may not carry a
    // GraphQL body at all.
    if (response.status === 429) {
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const body = await safeParseJson(response);
        const envelope = isThrottledEnvelope(body) || body ? (body as ShopifyGraphQLEnvelope) : null;
        await sleep(backoffDelayMs(attempt, envelope, response.headers.get("Retry-After")));
        continue;
      }
      return { ok: false, reason: "http-error", status: 429 };
    }

    if (!response.ok) {
      return { ok: false, reason: "http-error", status: response.status };
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { ok: false, reason: "network-error", message };
    }

    // Cost-based rate limit — HTTP 200 with a GraphQL-level "Throttled"
    // error instead of (or alongside) real data.
    if (isThrottledEnvelope(parsed) && attempt < MAX_RETRY_ATTEMPTS) {
      await sleep(backoffDelayMs(attempt, parsed as ShopifyGraphQLEnvelope, null));
      continue;
    }

    return { ok: true, status: response.status, body: parsed as T };
  }
}
