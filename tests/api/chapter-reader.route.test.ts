import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  chapterFindFirstMock,
  chapterUpdateMock,
  fetchReaderPagesMock,
  getCurrentUserIdMock,
  mangaFindUniqueMock,
  userMangaFindUniqueMock,
} = vi.hoisted(() => ({
  chapterFindFirstMock: vi.fn(),
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
});
