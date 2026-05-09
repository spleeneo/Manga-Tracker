import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  chapterFindManyMock,
  getCurrentUserIdMock,
  mangaFindUniqueMock,
  sourceFindFirstMock,
  userMangaFindUniqueMock,
} = vi.hoisted(() => ({
  chapterFindManyMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  sourceFindFirstMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    chapter: { findMany: chapterFindManyMock },
    manga: { findUnique: mangaFindUniqueMock },
    source: { findFirst: sourceFindFirstMock },
    userManga: { findUnique: userMangaFindUniqueMock },
  },
}));

import { GET } from "@/app/api/manga/[slug]/chapters/route";

describe("GET /api/manga/[slug]/chapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    mangaFindUniqueMock.mockResolvedValue({ id: "m1" });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1", lastReadChapterNumber: 1 });
    sourceFindFirstMock.mockResolvedValue({ id: "s1" });
  });

  it("requires ownership before returning chapter pages", async () => {
    userMangaFindUniqueMock.mockResolvedValue(null);

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(403);
    expect(chapterFindManyMock).not.toHaveBeenCalled();
  });

  it("returns a paged chapter slice with user read state", async () => {
    chapterFindManyMock.mockResolvedValue([
      { id: "c1", chapterNumber: 2, title: "Two", url: "u1", releaseDate: null, sourceId: "s1" },
      { id: "c2", chapterNumber: 1, title: "One", url: "u2", releaseDate: null, sourceId: "s1" },
      { id: "c3", chapterNumber: 0, title: "Zero", url: "u3", releaseDate: null, sourceId: "s1" },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters?limit=2&cursor=3&sourceId=s1&mode=all") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe("all");
    expect(body.nextCursor).toBe(1);
    expect(body.chapters).toEqual([
      expect.objectContaining({ id: "c1", isRead: false }),
      expect.objectContaining({ id: "c2", isRead: true }),
    ]);
    expect(chapterFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      take: 3,
      where: expect.objectContaining({
        mangaId: "m1",
        sourceId: "s1",
        chapterNumber: { lt: 3 },
      }),
    }));
  });
});
