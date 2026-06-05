import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  chapterFindFirstMock,
  chapterFindManyMock,
  chapterUpdateMock,
  fetchReaderPagesMock,
  getCurrentUserIdMock,
  mangaFindUniqueMock,
  userMangaFindUniqueMock,
} = vi.hoisted(() => ({
  chapterFindFirstMock: vi.fn(),
  chapterFindManyMock: vi.fn(),
  chapterUpdateMock: vi.fn(),
  fetchReaderPagesMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/scrapers/registry", () => ({
  fetchReaderPages: fetchReaderPagesMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    chapter: {
      findFirst: chapterFindFirstMock,
      findMany: chapterFindManyMock,
      update: chapterUpdateMock,
    },
    manga: {
      findUnique: mangaFindUniqueMock,
    },
    userManga: {
      findUnique: userMangaFindUniqueMock,
    },
  },
}));

import { GET } from "@/app/api/manga/[slug]/chapter/[chapterId]/reader/route";

describe("GET /api/manga/[slug]/chapter/[chapterId]/reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    mangaFindUniqueMock.mockResolvedValue({ id: "m1" });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1" });
    chapterFindFirstMock.mockResolvedValue({
      id: "c1",
      providerChapterId: "md-c1",
      chapterNumber: 12,
      title: "Twelve",
      url: "https://mangadex.org/chapter/md-c1",
      source: {
        id: "s1",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/title-id",
      },
    });
    fetchReaderPagesMock.mockResolvedValue({
      status: "READABLE",
      pages: [{ index: 0, imageUrl: "https://uploads.mangadex.org/data/hash/p1.jpg" }],
      externalUrl: "https://mangadex.org/chapter/md-c1",
    });
    chapterFindManyMock.mockResolvedValue([]);
    chapterUpdateMock.mockResolvedValue({});
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece", chapterId: "c1" }),
    });

    expect(res.status).toBe(401);
    expect(fetchReaderPagesMock).not.toHaveBeenCalled();
  });

  it("requires the user to track the manga", async () => {
    userMangaFindUniqueMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece", chapterId: "c1" }),
    });

    expect(res.status).toBe(403);
    expect(fetchReaderPagesMock).not.toHaveBeenCalled();
  });

  it("returns readable pages and persists reader metadata", async () => {
    const res = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece", chapterId: "c1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("READABLE");
    expect(body.pages).toHaveLength(1);
    expect(fetchReaderPagesMock).toHaveBeenCalledWith(
      expect.objectContaining({ providerChapterId: "md-c1" }),
      expect.objectContaining({ sourceName: "MangaDex" }),
    );
    expect(chapterUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "c1" },
      data: expect.objectContaining({
        readerStatus: "READABLE",
        readerPageCount: 1,
        readerError: null,
      }),
    }));
  });

  it("falls back to external-only when the provider is unsupported", async () => {
    fetchReaderPagesMock.mockResolvedValue({
      status: "EXTERNAL_ONLY",
      pages: [],
      externalUrl: "https://example.com/chapter",
      reason: "Provider is not supported yet.",
    });

    const res = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece", chapterId: "c1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("EXTERNAL_ONLY");
    expect(body.pages).toEqual([]);
    expect(chapterUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        readerStatus: "EXTERNAL_ONLY",
        readerPageCount: 0,
        readerError: "Provider is not supported yet.",
      }),
    }));
  });

  it("uses a readable same-number chapter from another source when the clicked source is blocked", async () => {
    chapterFindFirstMock.mockResolvedValue({
      id: "c1",
      providerChapterId: "urek-c1",
      chapterNumber: 12,
      title: "Twelve",
      url: "https://urekmazino.com/chapter/12/",
      source: {
        id: "s1",
        sourceName: "Urek Mazino",
        sourceUrl: "https://urekmazino.com/",
      },
    });
    chapterFindManyMock.mockResolvedValue([
      {
        id: "c2",
        providerChapterId: "md-c2",
        chapterNumber: 12,
        title: "Twelve",
        url: "https://mangadex.org/chapter/md-c2",
        source: {
          id: "s2",
          sourceName: "MangaDex",
          sourceUrl: "https://mangadex.org/title/title-id",
        },
      },
    ]);
    fetchReaderPagesMock
      .mockResolvedValueOnce({
        status: "BLOCKED",
        pages: [],
        externalUrl: "https://urekmazino.com/chapter/12/",
        reason: "Urek Mazino blocked Mangateo from loading this chapter directly.",
      })
      .mockResolvedValueOnce({
        status: "READABLE",
        pages: [{ index: 0, imageUrl: "https://uploads.mangadex.org/data/hash/p1.jpg" }],
        externalUrl: "https://mangadex.org/chapter/md-c2",
      });

    const res = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece", chapterId: "c1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("READABLE");
    expect(body.usedAlternative).toBe(true);
    expect(body.chapter).toEqual(expect.objectContaining({
      id: "c2",
      sourceName: "MangaDex",
    }));
    expect(fetchReaderPagesMock).toHaveBeenCalledTimes(2);
    expect(chapterUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "c1" },
      data: expect.objectContaining({ readerStatus: "BLOCKED" }),
    }));
    expect(chapterUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "c2" },
      data: expect.objectContaining({ readerStatus: "READABLE", readerError: null }),
    }));
  });

  it("does not replace external-reader chapters with another provider alternative", async () => {
    chapterFindFirstMock.mockResolvedValue({
      id: "mp-35",
      providerChapterId: "1029242",
      chapterNumber: 35,
      title: "#035: The Aircraft Carrier Floor, Part 2",
      url: "https://mangaplus.shueisha.co.jp/viewer/1029242",
      source: {
        id: "s1",
        sourceName: "MangaPlus",
        sourceUrl: "https://mangaplus.shueisha.co.jp/titles/100453",
      },
    });
    chapterFindManyMock.mockResolvedValue([{
      id: "md-35",
      providerChapterId: "8f39a659-9041-4311-8252-1162c1085802",
      chapterNumber: 35,
      title: "The Aircraft Carrier Floor, Part 2",
      url: "https://mangadex.org/chapter/8f39a659-9041-4311-8252-1162c1085802",
      source: {
        id: "s2",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/b2cf00db-3b05-4f3e-8a85-6af7a83e8aba",
      },
    }]);
    fetchReaderPagesMock.mockResolvedValueOnce({
      status: "EXTERNAL_ONLY",
      pages: [],
      externalUrl: "https://mangaplus.shueisha.co.jp/viewer/1029242",
      reason: "MangaPlus does not support the Mangateo reader yet.",
    });

    const res = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "maison", chapterId: "mp-35" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("EXTERNAL_ONLY");
    expect(body.externalUrl).toBe("https://mangaplus.shueisha.co.jp/viewer/1029242");
    expect(body.usedAlternative).toBe(false);
    expect(body.chapter).toEqual(expect.objectContaining({
      id: "mp-35",
      sourceName: "MangaPlus",
    }));
    expect(chapterFindManyMock).not.toHaveBeenCalled();
    expect(fetchReaderPagesMock).toHaveBeenCalledTimes(1);
  });
});
