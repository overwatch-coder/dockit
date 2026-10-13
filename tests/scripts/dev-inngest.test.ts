import { describe, expect, it, vi, beforeEach } from "vitest";
import { isDockitEndpoint, detectDockitPort } from "@/scripts/dev-inngest.mjs";

describe("dev-inngest environment port detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isDockitEndpoint returns true when endpoint returns 200 with Inngest headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({
        "x-inngest-sdk-handled": "true",
        "x-inngest-framework": "nextjs",
      }),
      text: vi.fn().mockResolvedValue('{"function_count":7}'),
    } as any);

    const result = await isDockitEndpoint("http://localhost:3001/api/jobs/run", mockFetch);
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/jobs/run",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("isDockitEndpoint returns false when port has another application returning 401", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      text: vi.fn().mockResolvedValue('{"error":"Sign in required"}'),
    } as any);

    const result = await isDockitEndpoint("http://localhost:3000/api/jobs/run", mockFetch);
    expect(result).toBe(false);
  });

  it("isDockitEndpoint returns false on network connection failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("fetch failed (ECONNREFUSED)"));

    const result = await isDockitEndpoint("http://localhost:3002/api/jobs/run", mockFetch);
    expect(result).toBe(false);
  });

  it("detects port 3001 when port 3000 is occupied by another app and port 3001 is Dockit", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes(":3000/")) {
        return Promise.resolve({
          status: 401,
          headers: new Headers(),
          text: () => Promise.resolve('{"error":"Unauthorized"}'),
        });
      }
      if (url.includes(":3001/")) {
        return Promise.resolve({
          status: 200,
          headers: new Headers({ "x-inngest-sdk-handled": "true" }),
          text: () => Promise.resolve('{"function_count":7}'),
        });
      }
      return Promise.reject(new Error("ECONNREFUSED"));
    });

    const logs: string[] = [];
    const port = await detectDockitPort({
      candidatePorts: [3000, 3001, 3002],
      fetchFn: mockFetch as any,
      logFn: (msg) => logs.push(msg),
      timeoutMs: 1000,
    });

    expect(port).toBe(3001);
    expect(logs.some((l) => l.includes("Detected active Dockit dev server on port 3001"))).toBe(true);
  });

  it("honors explicitPort if passed and responsive", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes(":3005/")) {
        return Promise.resolve({
          status: 200,
          headers: new Headers({ "x-inngest-sdk-handled": "true" }),
          text: () => Promise.resolve('{"function_count":7}'),
        });
      }
      return Promise.reject(new Error("ECONNREFUSED"));
    });

    const port = await detectDockitPort({
      explicitPort: 3005,
      candidatePorts: [3000, 3001, 3002],
      fetchFn: mockFetch as any,
      logFn: () => {},
      timeoutMs: 1000,
    });

    expect(port).toBe(3005);
  });

  it("falls back gracefully when probing times out", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const logs: string[] = [];

    const port = await detectDockitPort({
      candidatePorts: [3000, 3001],
      fetchFn: mockFetch as any,
      logFn: (msg) => logs.push(msg),
      timeoutMs: 50,
      pollIntervalMs: 20,
    });

    expect(port).toBe(3000);
    expect(logs.some((l) => l.includes("Timed out probing dev server"))).toBe(true);
  });
});
