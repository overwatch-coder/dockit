import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { postShopifyGraphQL } from "@/lib/shopify/client";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function okResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function throttledGraphQLResponse(overrides: { requestedQueryCost?: number; currentlyAvailable?: number; restoreRate?: number } = {}) {
  return new Response(
    JSON.stringify({
      errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
      extensions: {
        cost: {
          requestedQueryCost: overrides.requestedQueryCost ?? 100,
          throttleStatus: {
            maximumAvailable: 1000,
            currentlyAvailable: overrides.currentlyAvailable ?? 0,
            restoreRate: overrides.restoreRate ?? 50,
          },
        },
      },
    }),
    { status: 200 }
  );
}

function http429Response(retryAfterSeconds?: number) {
  return new Response(null, {
    status: 429,
    headers: retryAfterSeconds !== undefined ? { "Retry-After": String(retryAfterSeconds) } : undefined,
  });
}

// Runs `work` under fake timers, flushing every scheduled retry delay in
// order (there can be more than one, scheduled one at a time as each retry
// resolves) before awaiting the final result — mirrors this project's
// existing fake-timer convention (tests/lib/hooks/use-job-polling.test.ts).
async function runWithFlushedRetries<T>(work: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return work;
}

describe("postShopifyGraphQL", () => {
  test("returns the parsed body on a normal successful response, with a single fetch call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ data: { shop: { name: "Test Shop" } } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postShopifyGraphQL("my-store.myshopify.com", "token", "{ shop { name } }", {});

    expect(result).toEqual({ ok: true, status: 200, body: { data: { shop: { name: "Test Shop" } } } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("sends the expected request shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ data: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await postShopifyGraphQL("my-store.myshopify.com", "shpat_test", "query Q { x }", { a: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://my-store.myshopify.com/admin/api/2026-07/graphql.json",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": "shpat_test",
        }),
        body: JSON.stringify({ query: "query Q { x }", variables: { a: 1 } }),
      })
    );
  });

  test("returns a typed http-error with no retry for a non-429, non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postShopifyGraphQL("my-store.myshopify.com", "bad-token", "{ shop { name } }", {});

    expect(result).toEqual({ ok: false, reason: "http-error", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("returns a typed network-error with no retry when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postShopifyGraphQL("my-store.myshopify.com", "token", "{ shop { name } }", {});

    expect(result).toEqual({ ok: false, reason: "network-error", message: "network down" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("returns a typed network-error with no retry on a malformed (non-JSON) 200 body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postShopifyGraphQL("my-store.myshopify.com", "token", "{ shop { name } }", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("network-error");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("retries a hard HTTP 429 and succeeds once the rate limit clears", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(http429Response())
      .mockResolvedValueOnce(http429Response())
      .mockResolvedValueOnce(okResponse({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWithFlushedRetries(
      postShopifyGraphQL("my-store.myshopify.com", "token", "{ shop { name } }", {})
    );

    expect(result).toEqual({ ok: true, status: 200, body: { data: { ok: true } } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("gives up after exhausting retries on a persistent HTTP 429", async () => {
    const fetchMock = vi.fn().mockResolvedValue(http429Response());
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWithFlushedRetries(
      postShopifyGraphQL("my-store.myshopify.com", "token", "{ shop { name } }", {})
    );

    expect(result).toEqual({ ok: false, reason: "http-error", status: 429 });
    // 1 initial attempt + 4 retries = 5 total fetch calls.
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("retries a cost-based GraphQL THROTTLED error and succeeds once the rate limit clears", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(throttledGraphQLResponse())
      .mockResolvedValueOnce(okResponse({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWithFlushedRetries(
      postShopifyGraphQL("my-store.myshopify.com", "token", "{ shop { name } }", {})
    );

    expect(result).toEqual({ ok: true, status: 200, body: { data: { ok: true } } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("hands back the still-throttled body unchanged after exhausting retries on a persistent THROTTLED error, rather than fabricating a new error", async () => {
    // A fresh Response per call — a Response body can only be read once,
    // so reusing a single instance across every mocked fetch call would
    // make the 2nd+ read fail for an unrelated reason (already-consumed
    // body), not because of anything the client under test did.
    const fetchMock = vi.fn().mockImplementation(async () => throttledGraphQLResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWithFlushedRetries(
      postShopifyGraphQL("my-store.myshopify.com", "token", "{ shop { name } }", {})
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.body as { errors: { message: string }[] }).errors[0].message).toBe("Throttled");
    }
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("waits at least as long as the throttleStatus math requires before retrying", async () => {
    // Short by 200 points at a restore rate of 50/sec → needs 4 real seconds.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(throttledGraphQLResponse({ requestedQueryCost: 200, currentlyAvailable: 0, restoreRate: 50 }))
      .mockResolvedValueOnce(okResponse({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = postShopifyGraphQL("my-store.myshopify.com", "token", "{ shop { name } }", {});

    // Not yet enough time for the computed ~4s backoff.
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3500);
    const result = await promise;

    expect(result).toEqual({ ok: true, status: 200, body: { data: { ok: true } } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("respects a Retry-After header on a bare 429 with no GraphQL body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(http429Response(3))
      .mockResolvedValueOnce(okResponse({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = postShopifyGraphQL("my-store.myshopify.com", "token", "{ shop { name } }", {});

    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1500);
    const result = await promise;

    expect(result).toEqual({ ok: true, status: 200, body: { data: { ok: true } } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
