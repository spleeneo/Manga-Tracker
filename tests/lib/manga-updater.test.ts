import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyManga, findFirstChapter, createChapter, updateManga, scrapeChapters } = vi.hoisted(() => ({
  findManyManga: vi.fn(),
  findFirstChapter: vi.fn(),
  createChapter: vi.fn(),
  updateManga: vi.fn(),
  scrapeChapters: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: { findMany: findManyManga, update: updateManga },
    chapter: { findFirst: findFirstChapter, create: createChapter },
  },
}));

vi.mock("@/lib/scrapers/registry", () => ({
  scrapeChapters,
}));

import { checkForUpdates } from "@/lib/manga-updater";

describe("checkForUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    findFirstChapter
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);

    await checkForUpdates("m1");
    expect(createChapter).toHaveBeenCalledTimes(1);
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
    findFirstChapter.mockResolvedValue(null);

    const results = await checkForUpdates("m1");
    expect(createChapter).toHaveBeenCalledTimes(1);
    expect(results[0].manga).toBe("Multi");
  });
});
