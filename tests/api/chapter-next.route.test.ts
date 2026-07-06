import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  chapterFindFirstMock,
  chapterFindManyMock,
  getCurrentUserIdMock,
  getMangaAccessMock,
  mangaFindUniqueMock,
  userMangaFindUniqueMock,
} = vi.hoisted(() => ({
  chapterFindFirstMock: vi.fn(),
  chapterFindManyMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  getMangaAccessMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/parental-controls", () => ({ getMangaAccess: getMangaAccessMock, parentalControlError: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    chapter: {
      findFirst: chapterFindFirstMock,
      findMany: chapterFindManyMock,
    },
    manga: { findUnique: mangaFindUniqueMock },
    userManga: { findUnique: userMangaFindUniqueMock },
  },
}));

import { GET } from "@/app/api/manga/[slug]/chapter/[chapterId]/next/route";

describe("GET /api/manga/[slug]/chapter/[chapterId]/next", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    getMangaAccessMock.mockResolvedValue({ allowed: true, isChild: false, reason: "allowed" });
    mangaFindUniqueMock.mockResolvedValue({ id: "m1" });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1" });
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 8, sourceId: "s1" });
  });

  it("returns only internal anonymized next chapters to children", async () => {
    getMangaAccessMock.mockResolvedValue({ allowed: true, isChild: true, reason: "allowed" });
    chapterFindManyMock.mockResolvedValue([{ id: "c9", chapterNumber: 9, title: "Nine", url: "https://secret.example/c9", source: { sourceName: "Secret" } }]);
    const req = { nextUrl: new URL("http://localhost/api/manga/urek/chapter/c8/next") };
    const res = await GET(req as never, { params: Promise.resolve({ slug: "urek", chapterId: "c8" }) });
    const body = await res.json();
    expect(chapterFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ readerStatus: "READABLE" }) }));
    expect(body.chapters[0]).toEqual({ id: "c9", chapterNumber: 9, title: "Nine", url: "/manga/urek/chapter/c9", sourceName: null });
  });

  it("returns the next same-source chapters for the reader stream", async () => {
    chapterFindManyMock.mockResolvedValue([
      { id: "c9", chapterNumber: 9, title: "Nine", url: "u9", source: { sourceName: "Urek Mazino" } },
      { id: "c10", chapterNumber: 10, title: "Ten", url: "u10", source: { sourceName: "Urek Mazino" } },
      { id: "c11", chapterNumber: 11, title: "Eleven", url: "u11", source: { sourceName: "Urek Mazino" } },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/urek/chapter/c8/next?limit=2") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "urek", chapterId: "c8" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      chapters: [
        { id: "c9", chapterNumber: 9, title: "Nine", url: "u9", sourceName: "Urek Mazino" },
        { id: "c10", chapterNumber: 10, title: "Ten", url: "u10", sourceName: "Urek Mazino" },
      ],
      hasMore: true,
    });
    expect(chapterFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        mangaId: "m1",
        sourceId: "s1",
        chapterNumber: { gt: 8 },
      },
      orderBy: [
        { chapterNumber: "asc" },
        { releaseDate: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      take: 3,
    }));
  });

  it("requires ownership before returning next reader chapters", async () => {
    userMangaFindUniqueMock.mockResolvedValue(null);

    const req = { nextUrl: new URL("http://localhost/api/manga/urek/chapter/c8/next") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "urek", chapterId: "c8" }),
    });

    expect(res.status).toBe(403);
    expect(chapterFindManyMock).not.toHaveBeenCalled();
  });
});
