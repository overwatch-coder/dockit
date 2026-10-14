import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProductSiblingNavigation } from "@/lib/db/products";
import { prisma } from "@/lib/db/client";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

describe("getProductSiblingNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates next, previous, currentIndex, and totalCount correctly for a middle item", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { id: "prod-1" },
      { id: "prod-2" },
      { id: "prod-3" },
    ] as any);

    const result = await getProductSiblingNavigation({
      accountId: "acc-1",
      storeId: "store-1",
      productId: "prod-2",
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { accountId: "acc-1", storeId: "store-1" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    expect(result).toEqual({
      prevProductId: "prod-1",
      nextProductId: "prod-3",
      currentIndex: 2,
      totalCount: 3,
    });
  });

  it("handles the first item correctly (no previous product)", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { id: "prod-1" },
      { id: "prod-2" },
    ] as any);

    const result = await getProductSiblingNavigation({
      accountId: "acc-1",
      storeId: "store-1",
      productId: "prod-1",
    });

    expect(result).toEqual({
      prevProductId: null,
      nextProductId: "prod-2",
      currentIndex: 1,
      totalCount: 2,
    });
  });

  it("handles the last item correctly (no next product)", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { id: "prod-1" },
      { id: "prod-2" },
    ] as any);

    const result = await getProductSiblingNavigation({
      accountId: "acc-1",
      storeId: "store-1",
      productId: "prod-2",
    });

    expect(result).toEqual({
      prevProductId: "prod-1",
      nextProductId: null,
      currentIndex: 2,
      totalCount: 2,
    });
  });

  it("handles a single item gracefully", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { id: "prod-1" },
    ] as any);

    const result = await getProductSiblingNavigation({
      accountId: "acc-1",
      storeId: "store-1",
      productId: "prod-1",
    });

    expect(result).toEqual({
      prevProductId: null,
      nextProductId: null,
      currentIndex: 1,
      totalCount: 1,
    });
  });
});
