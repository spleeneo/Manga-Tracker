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

  it("searches by relevance and retains identity metadata for In the name of God", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(jsonResponse({ data: [{
      id: "6eca560a-d5e3-4711-88c4-5676e3cd8364",
      attributes: { title: { en: "In the name of God" }, altTitles: [{ ja: "Alternate title" }], description: {} },
      relationships: [{ type: "author", attributes: { name: "Author" } }],
    }] }));
    const results = await new MangaDexScraper().search("in the name of god");
    const url = new URL(fetchWithRetryMock.mock.calls[0][0]);
    expect(url.searchParams.get("order[relevance]")).toBe("desc");
    expect(url.searchParams.get("limit")).toBe("24");
    expect(results[0]).toMatchObject({ title: "In the name of God", alternateTitles: ["Alternate title"], author: "Author", providerId: "6eca560a-d5e3-4711-88c4-5676e3cd8364" });
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

  it("imports the unnumbered In the name of God one-shot as chapter zero", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(jsonResponse({ data: [{
      id: "0aa19790-09b3-4dee-8c83-711f58e27b2c",
      attributes: { chapter: null, title: "Bronze Award: In the name of God", publishAt: "2026-01-01T00:00:00Z" },
    }], total: 1, limit: 100 }));
    expect(await new MangaDexScraper().fetchChapters("https://mangadex.org/title/6eca560a-d5e3-4711-88c4-5676e3cd8364")).toEqual([{
      providerChapterId: "0aa19790-09b3-4dee-8c83-711f58e27b2c",
      chapterNumber: 0,
      title: "Bronze Award: In the name of God",
      url: "https://mangadex.org/chapter/0aa19790-09b3-4dee-8c83-711f58e27b2c",
      releaseDate: new Date("2026-01-01T00:00:00Z"),
    }]);
  });

  it("does not collapse multiple unnumbered releases into chapter zero", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(jsonResponse({ data: [
      { ...chapter("a", "1"), attributes: { ...chapter("a", "1").attributes, chapter: null } },
      { ...chapter("b", "2"), attributes: { ...chapter("b", "2").attributes, chapter: null } },
    ], total: 2, limit: 100 }));
    expect(await new MangaDexScraper().fetchChapters("https://mangadex.org/title/6eca560a-d5e3-4711-88c4-5676e3cd8364")).toEqual([]);
  });

  it("maps MangaDex AtHome pages for the in-app reader", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(jsonResponse({
      baseUrl: "https://uploads.mangadex.org",
      chapter: {
        hash: "hash",
        data: ["p1.jpg", "p2.jpg"],
      },
    }));

    const scraper = new MangaDexScraper();
    const result = await scraper.fetchReaderPages({
      id: "chapter-id",
      providerChapterId: "md-chapter-id",
      url: "https://mangadex.org/chapter/md-chapter-id",
      chapterNumber: 1,
      title: "One",
    }, {
      id: "source-id",
      sourceName: "MangaDex",
      sourceUrl: "https://mangadex.org/title/11111111-1111-1111-1111-111111111111/test",
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages).toEqual([
      { index: 0, imageUrl: "https://uploads.mangadex.org/data/hash/p1.jpg" },
      { index: 1, imageUrl: "https://uploads.mangadex.org/data/hash/p2.jpg" },
    ]);
  });

  it("normalizes MangaDex metadata statuses", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(jsonResponse({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        attributes: {
          title: { en: "Done" },
          description: { en: "Finished series." },
          status: "completed",
        },
        relationships: [],
      },
    }));

    const scraper = new MangaDexScraper();
    const metadata = await scraper.fetchMetadata("https://mangadex.org/title/11111111-1111-1111-1111-111111111111/done");

    expect(metadata.status).toBe("COMPLETED");
  });
});
