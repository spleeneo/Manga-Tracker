import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findManyManga,
  findManyChapter,
  createManyChapter,
  updateManga,
  updateSource,
  upsertSource,
  scrapeChapters,
  discoverSingleMangaSiteSources,
} = vi.hoisted(() => ({
  findManyManga: vi.fn(),
  findManyChapter: vi.fn(),
  createManyChapter: vi.fn(),
  updateManga: vi.fn(),
  updateSource: vi.fn(),
  upsertSource: vi.fn(),
  scrapeChapters: vi.fn(),
  discoverSingleMangaSiteSources: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: { findMany: findManyManga, update: updateManga },
    chapter: { findMany: findManyChapter, createMany: createManyChapter },
    source: { update: updateSource, upsert: upsertSource },
  },
}));

vi.mock("@/lib/scrapers/registry", () => ({
  scrapeChapters,
}));

vi.mock("@/lib/scrapers/single-manga-sites", () => ({
  SINGLE_MANGA_SITE_SOURCE_NAMES: [
    "witch hat atelier manga",
    "land of the lustrous",
    "bleach live",
    "blue lock manga",
    "fire punch",
  ],
  discoverSingleMangaSiteSources,
}));

import { checkForUpdates } from "@/lib/manga-updater";

describe("checkForUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyChapter.mockResolvedValue([]);
    createManyChapter.mockResolvedValue({ count: 0 });
    updateSource.mockResolvedValue({});
    upsertSource.mockResolvedValue({});
    discoverSingleMangaSiteSources.mockResolvedValue([]);
  });

  it("reports manga with no sources", async () => {
    findManyManga.mockResolvedValue([
      { id: "m1", title: "No Source", sources: [] },
    ]);

    const results = await checkForUpdates("m1");
    expect(results[0].status).toContain("No sources identified");
  });

  it("creates only non-existing chapters per source", async () => {
    findManyManga.mockResolvedValue([
      {
        id: "m1",
        title: "One Piece",
        sources: [{ id: "s1", sourceName: "MangaDex", sourceUrl: "https://mangadex.org/title/x" }],
      },
    ]);

    scrapeChapters.mockResolvedValue([
      { chapterNumber: 1100, url: "u1", title: "A", releaseDate: new Date() },
      { chapterNumber: 1101, url: "u2", title: "B", releaseDate: new Date() },
    ]);
    findManyChapter.mockResolvedValue([{ providerChapterId: null, chapterNumber: 1100 }]);
    createManyChapter.mockResolvedValue({ count: 1 });

    await checkForUpdates("m1");
    expect(createManyChapter).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ chapterNumber: 1101 })],
      skipDuplicates: true,
    }));
    expect(updateManga).toHaveBeenCalledTimes(1);
  });

  it("continues when one source fails", async () => {
    findManyManga.mockResolvedValue([
      {
        id: "m1",
        title: "Multi",
        sources: [
          { id: "s1", sourceName: "Bad", sourceUrl: "bad-url" },
          { id: "s2", sourceName: "Good", sourceUrl: "good-url" },
        ],
      },
    ]);

    scrapeChapters
      .mockRejectedValueOnce(new Error("bad source"))
      .mockResolvedValueOnce([{ chapterNumber: 1, url: "good", title: "c1", releaseDate: new Date() }]);
    createManyChapter.mockResolvedValue({ count: 1 });

    const results = await checkForUpdates("m1");
    expect(createManyChapter).toHaveBeenCalledTimes(1);
    expect(updateSource).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "s1" },
      data: expect.objectContaining({ failureCount: { increment: 1 } }),
    }));
    expect(results[0].manga).toBe("Multi");
  });

  it("adds a discovered dedicated manga source before scraping", async () => {
    findManyManga.mockResolvedValue([
      {
        id: "m1",
        title: "Sakamoto Days",
        sources: [{ id: "s1", sourceName: "MangaDex", sourceUrl: "https://mangadex.org/title/x" }],
      },
    ]);
    discoverSingleMangaSiteSources.mockResolvedValue([{
      title: "Sakamoto Days",
      sourceName: "Sakamoto Days Manga",
      sourceUrl: "https://w45.sakamoto-days-manga.com/",
    }]);
    upsertSource.mockResolvedValue({
      id: "s2",
      sourceName: "Sakamoto Days Manga",
      sourceUrl: "https://w45.sakamoto-days-manga.com/",
    });
    scrapeChapters
      .mockResolvedValueOnce([{ chapterNumber: 1, url: "dedicated", title: "Chapter 1" }])
      .mockResolvedValueOnce([]);
    createManyChapter.mockResolvedValueOnce({ count: 1 });

    await checkForUpdates("m1");

    expect(upsertSource).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        mangaId_sourceUrl: {
          mangaId: "m1",
          sourceUrl: "https://w45.sakamoto-days-manga.com/",
        },
      },
    }));
    expect(scrapeChapters).toHaveBeenNthCalledWith(1, "https://w45.sakamoto-days-manga.com/");
    expect(scrapeChapters).toHaveBeenNthCalledWith(2, "https://mangadex.org/title/x");
  });
});
