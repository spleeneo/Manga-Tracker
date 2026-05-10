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

import { MangaDexScraper } from "@/lib/scrapers/mangadex";

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  };
}

function chapter(id: string, chapterNumber: string) {
  return {
    id,
    attributes: {
      chapter: chapterNumber,
      title: `Chapter ${chapterNumber}`,
      publishAt: "2026-01-01T00:00:00+00:00",
    },
  };
}

describe("MangaDexScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches all paginated feed offsets", async () => {
    fetchWithRetryMock
      .mockResolvedValueOnce(jsonResponse({
        data: Array.from({ length: 100 }, (_, index) => chapter(`c${index}`, String(150 - index))),
        limit: 100,
        offset: 0,
        total: 101,
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: [chapter("c100", "50")],
        limit: 100,
        offset: 100,
        total: 101,
      }));

    const scraper = new MangaDexScraper();
    const chapters = await scraper.fetchChapters("https://mangadex.org/title/11111111-1111-1111-1111-111111111111/test");

    expect(chapters).toHaveLength(101);
    expect(chapters.at(-1)?.chapterNumber).toBe(50);
    expect(fetchWithRetryMock).toHaveBeenCalledTimes(2);
    expect(fetchWithRetryMock.mock.calls[0][0]).toContain("limit=100&offset=0");
    expect(fetchWithRetryMock.mock.calls[1][0]).toContain("limit=100&offset=100");
  });
});
