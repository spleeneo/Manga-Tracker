import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  chapterAggregateMock,
  chapterFindFirstMock,
  getCurrentUserIdMock,
  getLibraryMangaSummaryMock,
  mangaFindUniqueMock,
  userMangaFindUniqueMock,
  userMangaUpdateMock,
} = vi.hoisted(() => ({
  chapterAggregateMock: vi.fn(),
  chapterFindFirstMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  getLibraryMangaSummaryMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
  userMangaUpdateMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/library-summary", () => ({
  getLibraryMangaSummary: getLibraryMangaSummaryMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    chapter: {
      aggregate: chapterAggregateMock,
      findFirst: chapterFindFirstMock,
    },
    manga: {
      findUnique: mangaFindUniqueMock,
    },
    userManga: {
      findUnique: userMangaFindUniqueMock,
      update: userMangaUpdateMock,
    },
  },
}));

import { POST } from "@/app/api/manga/[slug]/progress/route";

describe("POST /api/manga/[slug]/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    mangaFindUniqueMock.mockResolvedValue({ id: "m1" });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1", mangaId: "m1", lastReadChapterNumber: 2 });
    userMangaUpdateMock.mockResolvedValue({ lastReadChapterNumber: 3, lastReadAt: new Date("2026-01-01") });
    getLibraryMangaSummaryMock.mockResolvedValue({ id: "m1", slug: "one-piece" });
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ action: "caught-up" }),
    });

    const res = await POST(req as never, { params: Promise.resolve({ slug: "one-piece" }) });

    expect(res.status).toBe(401);
  });

  it("requires tracked manga", async () => {
    userMangaFindUniqueMock.mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ action: "caught-up" }),
    });

    const res = await POST(req as never, { params: Promise.resolve({ slug: "one-piece" }) });

    expect(res.status).toBe(403);
    expect(userMangaUpdateMock).not.toHaveBeenCalled();
  });

  it("sets progress to a specific chapter number", async () => {
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 4 });
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ action: "set", chapterNumber: 4 }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never, { params: Promise.resolve({ slug: "one-piece" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(userMangaUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastReadChapterNumber: 4 }),
    }));
    expect(body.summary).toEqual({ id: "m1", slug: "one-piece" });
  });

  it("advances to the next unread chapter", async () => {
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 3 });
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ action: "next" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never, { params: Promise.resolve({ slug: "one-piece" }) });

    expect(res.status).toBe(200);
    expect(chapterFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ chapterNumber: { gt: 2 } }),
      orderBy: { chapterNumber: "asc" },
    }));
    expect(userMangaUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastReadChapterNumber: 3 }),
    }));
  });

  it("marks caught up to the latest chapter", async () => {
    chapterAggregateMock.mockResolvedValue({ _max: { chapterNumber: 8 } });
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ action: "caught-up" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never, { params: Promise.resolve({ slug: "one-piece" }) });

    expect(res.status).toBe(200);
    expect(userMangaUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastReadChapterNumber: 8 }),
    }));
  });

  it("moves progress back to the previous chapter number", async () => {
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 1 });
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ action: "previous", chapterNumber: 2 }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never, { params: Promise.resolve({ slug: "one-piece" }) });

    expect(res.status).toBe(200);
    expect(chapterFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ chapterNumber: { lt: 2 } }),
      orderBy: { chapterNumber: "desc" },
    }));
    expect(userMangaUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastReadChapterNumber: 1 }),
    }));
  });
});
