import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentUserIdMock,
  mangaFindUniqueMock,
  sourceFindFirstMock,
  userMangaFindUniqueMock,
  disabledSourceUpsertMock,
  disabledSourceDeleteManyMock,
} = vi.hoisted(() => ({
  getCurrentUserIdMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  sourceFindFirstMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
  disabledSourceUpsertMock: vi.fn(),
  disabledSourceDeleteManyMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: { findUnique: mangaFindUniqueMock },
    source: { findFirst: sourceFindFirstMock },
    userManga: { findUnique: userMangaFindUniqueMock },
    userMangaDisabledSource: {
      upsert: disabledSourceUpsertMock,
      deleteMany: disabledSourceDeleteManyMock,
    },
  },
}));

import { PATCH } from "@/app/api/manga/[slug]/sources/[sourceId]/route";

describe("PATCH /api/manga/[slug]/sources/[sourceId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    mangaFindUniqueMock.mockResolvedValue({ id: "m1" });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1" });
    sourceFindFirstMock.mockResolvedValue({ id: "s1" });
    disabledSourceUpsertMock.mockResolvedValue({ id: "d1" });
    disabledSourceDeleteManyMock.mockResolvedValue({ count: 1 });
  });

  it("requires a boolean disabled value", async () => {
    const req = new Request("http://localhost/api/manga/one-piece/sources/s1", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req as never, {
      params: Promise.resolve({ slug: "one-piece", sourceId: "s1" }),
    });

    expect(res.status).toBe(400);
    expect(disabledSourceUpsertMock).not.toHaveBeenCalled();
    expect(disabledSourceDeleteManyMock).not.toHaveBeenCalled();
  });

  it("disables a source for the current user's tracked manga", async () => {
    const req = new Request("http://localhost/api/manga/one-piece/sources/s1", {
      method: "PATCH",
      body: JSON.stringify({ disabled: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req as never, {
      params: Promise.resolve({ slug: "one-piece", sourceId: "s1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ sourceId: "s1", disabled: true });
    expect(disabledSourceUpsertMock).toHaveBeenCalledWith({
      where: {
        userMangaId_sourceId: {
          userMangaId: "um1",
          sourceId: "s1",
        },
      },
      update: {},
      create: {
        userMangaId: "um1",
        sourceId: "s1",
      },
    });
  });

  it("reenables a source for the current user's tracked manga", async () => {
    const req = new Request("http://localhost/api/manga/one-piece/sources/s1", {
      method: "PATCH",
      body: JSON.stringify({ disabled: false }),
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req as never, {
      params: Promise.resolve({ slug: "one-piece", sourceId: "s1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ sourceId: "s1", disabled: false });
    expect(disabledSourceDeleteManyMock).toHaveBeenCalledWith({
      where: {
        userMangaId: "um1",
        sourceId: "s1",
      },
    });
  });

  it("does not update sources from a different manga", async () => {
    sourceFindFirstMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/manga/one-piece/sources/s-other", {
      method: "PATCH",
      body: JSON.stringify({ disabled: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await PATCH(req as never, {
      params: Promise.resolve({ slug: "one-piece", sourceId: "s-other" }),
    });

    expect(res.status).toBe(404);
    expect(disabledSourceUpsertMock).not.toHaveBeenCalled();
  });
});
