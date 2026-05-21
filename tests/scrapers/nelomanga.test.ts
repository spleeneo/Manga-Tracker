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

import { NeloMangaScraper } from "@/lib/scrapers/nelomanga";

function jsonResponse(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  };
}

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("NeloMangaScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches all paginated chapter offsets", async () => {
    fetchWithRetryMock
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          chapters: [
            { chapter_slug: "chapter-96", chapter_num: 96, chapter_name: "Chapter 96", updated_at: "2026-05-06T04:27:43.000000Z" },
            { chapter_slug: "chapter-95", chapter_num: 95, chapter_name: "Chapter 95", updated_at: "2026-04-04T04:27:43.000000Z" },
          ],
          pagination: { total: 3, limit: 2, offset: 0, has_more: true },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          chapters: [
            { chapter_slug: "chapter-1", chapter_num: 1, chapter_name: "Chapter 1", updated_at: "2025-01-01T04:27:43.000000Z" },
          ],
          pagination: { total: 3, limit: 2, offset: 2, has_more: false },
        },
      }));

    const scraper = new NeloMangaScraper();
    const chapters = await scraper.fetchChapters("https://www.nelomanga.net/manga/tongari-boushi-no-atelier");

    expect(chapters.map((chapter) => chapter.chapterNumber)).toEqual([96, 95, 1]);
    expect(fetchWithRetryMock).toHaveBeenCalledTimes(2);
    expect(fetchWithRetryMock.mock.calls[0][0]).toBe("https://www.nelomanga.net/api/manga/tongari-boushi-no-atelier/chapters");
    expect(fetchWithRetryMock.mock.calls[1][0]).toBe("https://www.nelomanga.net/api/manga/tongari-boushi-no-atelier/chapters?offset=2");
  });

  it("maps public chapter images for the in-app reader", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <div class="chapter-reader">
        <img src="https://www.nelomanga.net/uploads/tongari/001.jpg" />
        <img data-src="https://www.nelomanga.net/uploads/tongari/002.webp" />
        <img src="/images/logo.png" />
      </div>
    `));

    const scraper = new NeloMangaScraper();
    const result = await scraper.fetchReaderPages({
      url: "https://www.nelomanga.net/manga/tongari-boushi-no-atelier/chapter-1",
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages).toEqual([
      { index: 0, imageUrl: "https://www.nelomanga.net/uploads/tongari/001.jpg" },
      { index: 1, imageUrl: "https://www.nelomanga.net/uploads/tongari/002.webp" },
    ]);
  });

  it("normalizes completed status from metadata pages", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <h1>Finished Manga</h1>
      <div id="contentBox">Summary: Done.</div>
      <div class="manga-info-pic"><img src="/cover.jpg"></div>
      <div class="info-status">Finished</div>
    `));

    const scraper = new NeloMangaScraper();
    const metadata = await scraper.fetchMetadata("https://www.nelomanga.net/manga/finished-manga");

    expect(metadata.status).toBe("COMPLETED");
  });
});
