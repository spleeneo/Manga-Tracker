import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkForUpdatesMock,
  fetchMetadataMock,
  getCurrentUserIdMock,
  mangaFindUniqueMock,
  mangaUpdateMock,
  userChapterFindManyMock,
  userMangaFindUniqueMock,
} = vi.hoisted(() => ({
  checkForUpdatesMock: vi.fn(),
  fetchMetadataMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  mangaUpdateMock: vi.fn(),
  userChapterFindManyMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/manga-updater", () => ({
  checkForUpdates: checkForUpdatesMock,
}));

vi.mock("@/lib/scrapers/registry", () => ({
  fetchMetadata: fetchMetadataMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: {
      findUnique: mangaFindUniqueMock,
      update: mangaUpdateMock,
    },
    userChapter: {
      findMany: userChapterFindManyMock,
    },
    userManga: {
      findUnique: userMangaFindUniqueMock,
    },
  },
}));

import { POST as checkUpdates } from "@/app/api/manga/[slug]/check-updates/route";
import { GET as getManga } from "@/app/api/manga/get/route";
import { POST as refreshMetadata } from "@/app/api/manga/[slug]/refresh-metadata/route";

describe("owned manga API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
  });

  it("requires ownership before checking updates", async () => {
    mangaFindUniqueMock.mockResolvedValue({ id: "m1", slug: "one-piece" });
    userMangaFindUniqueMock.mockResolvedValue(null);

    const res = await checkUpdates(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(403);
    expect(checkForUpdatesMock).not.toHaveBeenCalled();
  });

  it("checks updates for tracked manga", async () => {
    mangaFindUniqueMock.mockResolvedValue({ id: "m1", slug: "one-piece" });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1" });
    checkForUpdatesMock.mockResolvedValue([{ status: "ok" }]);

    const res = await checkUpdates(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(checkForUpdatesMock).toHaveBeenCalledWith("m1");
  });

  it("requires ownership before returning manga data", async () => {
    mangaFindUniqueMock.mockResolvedValue({ id: "m1", chapters: [], sources: [] });
    userMangaFindUniqueMock.mockResolvedValue(null);

    const req = { nextUrl: new URL("http://localhost/api/manga/get?slug=one-piece") };
    const res = await getManga(req as never);

    expect(res.status).toBe(403);
    expect(userChapterFindManyMock).not.toHaveBeenCalled();
  });

  it("returns user-specific read state for tracked manga data", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      chapters: [
        { id: "c1", chapterNumber: 1 },
        { id: "c2", chapterNumber: 2 },
      ],
      sources: [],
    });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1" });
    userChapterFindManyMock.mockResolvedValue([{ chapterId: "c2", isRead: true }]);

    const req = { nextUrl: new URL("http://localhost/api/manga/get?slug=one-piece") };
    const res = await getManga(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chapters).toEqual([
      expect.objectContaining({ id: "c1", isRead: false }),
      expect.objectContaining({ id: "c2", isRead: true }),
    ]);
  });

  it("requires ownership before refreshing metadata", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "one-piece",
      sources: [{ sourceUrl: "https://example.com", sourceName: "Source" }],
    });
    userMangaFindUniqueMock.mockResolvedValue(null);

    const res = await refreshMetadata(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(403);
    expect(fetchMetadataMock).not.toHaveBeenCalled();
  });
});
