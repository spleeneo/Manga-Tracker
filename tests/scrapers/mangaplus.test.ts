import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
  ScraperRequestError: class ScraperRequestError extends Error {
    constructor(
      message: string,
      public kind: string,
      public status?: number,
    ) {
      super(message);
      this.name = "ScraperRequestError";
    }
  },
}));

import { MangaPlusScraper } from "@/lib/scrapers/mangaplus";

function jsonResponse(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("MangaPlusScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks public first/latest chapters and skips archive-only middle chapters", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(jsonResponse({
      success: {
        titleDetailView: {
          chapterListGroup: [
            {
              firstChapterList: [
                { chapterId: 1000303, name: "#001", subTitle: "Cruelty", startTimeStamp: 1704067200 },
                { chapterId: 1006664, name: "ex", subTitle: "Special one shot" },
              ],
              midChapterList: [
                { chapterId: 1000304, name: "#002", subTitle: "Trainer Sakonji Urokodaki" },
                { chapterId: 1000305, name: "#003", subTitle: "Return by Dawn" },
              ],
              lastChapterList: [
                { chapterId: 1000306, name: "#004", subTitle: "Tanjiro's Journal, Part 1" },
              ],
            },
          ],
        },
      },
    }));

    const scraper = new MangaPlusScraper();
    const chapters = await scraper.fetchChapters("https://mangaplus.shueisha.co.jp/titles/100009");

    expect(chapters.map((chapter) => chapter.chapterNumber)).toEqual([1, 4]);
    expect(chapters.map((chapter) => chapter.url)).toEqual([
      "https://mangaplus.shueisha.co.jp/viewer/1000303",
      "https://mangaplus.shueisha.co.jp/viewer/1000306",
    ]);
    expect(chapters.some((chapter) => chapter.chapterNumber === 1006664)).toBe(false);
    expect(chapters.some((chapter) => chapter.chapterNumber === 2)).toBe(false);
  });
});
