import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentUserIdMock,
  mangaFindUniqueMock,
  sourceFindManyMock,
  userMangaFindUniqueMock,
  preferenceDeleteManyMock,
  preferenceUpsertMock,
  transactionMock,
} = vi.hoisted(() => ({
  getCurrentUserIdMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  sourceFindManyMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
  preferenceDeleteManyMock: vi.fn(),
  preferenceUpsertMock: vi.fn(),
  transactionMock: vi.fn(async (operations) => operations),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transactionMock,
    manga: { findUnique: mangaFindUniqueMock },
    source: { findMany: sourceFindManyMock },
    userManga: { findUnique: userMangaFindUniqueMock },
    userMangaSourcePreference: {
      deleteMany: preferenceDeleteManyMock,
      upsert: preferenceUpsertMock,
    },
  },
}));

import { PUT } from "@/app/api/manga/[slug]/sources/route";

describe("PUT /api/manga/[slug]/sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    mangaFindUniqueMock.mockResolvedValue({ id: "m1" });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1" });
    sourceFindManyMock.mockResolvedValue([{ id: "s2" }, { id: "s1" }]);
    preferenceDeleteManyMock.mockResolvedValue({ count: 0 });
    preferenceUpsertMock.mockResolvedValue({ id: "pref" });
  });

  it("requires a valid source id array", async () => {
    const req = new Request("http://localhost/api/manga/one-piece/sources", {
      method: "PUT",
      body: JSON.stringify({ sourceIds: "s1" }),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects source ids outside the tracked manga", async () => {
    sourceFindManyMock.mockResolvedValue([{ id: "s2" }]);
    const req = new Request("http://localhost/api/manga/one-piece/sources", {
      method: "PUT",
      body: JSON.stringify({ sourceIds: ["s2", "not-this-manga"] }),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(404);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("saves source order for the current user's manga", async () => {
    const req = new Request("http://localhost/api/manga/one-piece/sources", {
      method: "PUT",
      body: JSON.stringify({ sourceIds: ["s2", "s1"] }),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sources).toEqual([
      { sourceId: "s2", position: 0 },
      { sourceId: "s1", position: 1 },
    ]);
    expect(preferenceDeleteManyMock).toHaveBeenCalledWith({
      where: {
        userMangaId: "um1",
        sourceId: { notIn: ["s2", "s1"] },
      },
    });
    expect(preferenceUpsertMock).toHaveBeenNthCalledWith(1, {
      where: {
        userMangaId_sourceId: {
          userMangaId: "um1",
          sourceId: "s2",
        },
      },
      update: { position: 0 },
      create: {
        userMangaId: "um1",
        sourceId: "s2",
        position: 0,
      },
    });
    expect(preferenceUpsertMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      update: { position: 1 },
    }));
    expect(transactionMock).toHaveBeenCalledOnce();
  });
});
