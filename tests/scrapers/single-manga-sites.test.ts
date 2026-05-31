import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { SingleMangaSiteScraper } from "@/lib/scrapers/single-manga-sites";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("SingleMangaSiteScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discovers configured single-manga sites by alias search", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <meta name="description" content="Read Blue Lock manga online." />
      <meta property="og:image" content="https://w45.blue-lock-manga.com/wp-content/uploads/blue-lock-cover.jpg" />
    `));

    const scraper = new SingleMangaSiteScraper();
    const results = await scraper.search("blue lock");

    expect(results).toEqual([{
      title: "Blue Lock",
      description: "Read Blue Lock manga online.",
      coverUrl: "https://w45.blue-lock-manga.com/wp-content/uploads/blue-lock-cover.jpg",
      status: "ONGOING",
      author: "Muneyuki Kaneshiro",
      sourceUrl: "https://w45.blue-lock-manga.com/",
      sourceName: "Blue Lock Manga",
    }]);
  });

  it("extracts chapters from configured WordPress-style manga links", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <a href="https://w45.blue-lock-manga.com/manga/blue-lock-chapter-291/">Blue Lock Chapter 291</a>
      <a href="/manga/blue-lock-chapter-100-5/">Blue Lock Chapter 100.5</a>
    `));

    const scraper = new SingleMangaSiteScraper();
    const chapters = await scraper.fetchChapters("https://w45.blue-lock-manga.com/");

    expect(chapters).toEqual([
      {
        providerChapterId: "291",
        chapterNumber: 291,
        title: "Blue Lock Chapter 291",
        url: "https://w45.blue-lock-manga.com/manga/blue-lock-chapter-291/",
      },
      {
        providerChapterId: "100.5",
        chapterNumber: 100.5,
        title: "Blue Lock Chapter 100.5",
        url: "https://w45.blue-lock-manga.com/manga/blue-lock-chapter-100-5/",
      },
    ]);
  });

  it("extracts public reader images while filtering chrome assets", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <img src="https://w45.blue-lock-manga.com/wp-content/uploads/blue-lock/001.jpg" width="900" height="1300" />
      <img data-src="https://w45.blue-lock-manga.com/wp-content/uploads/blue-lock/002.webp" />
      <img src="https://w45.blue-lock-manga.com/wp-content/themes/theme/logo.png" />
    `));

    const scraper = new SingleMangaSiteScraper();
    const result = await scraper.fetchReaderPages({
      id: "chapter-id",
      url: "https://w45.blue-lock-manga.com/manga/blue-lock-chapter-1/",
      chapterNumber: 1,
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages).toEqual([
      {
        index: 0,
        imageUrl: "https://w45.blue-lock-manga.com/wp-content/uploads/blue-lock/001.jpg",
        width: 900,
        height: 1300,
      },
      {
        index: 1,
        imageUrl: "https://w45.blue-lock-manga.com/wp-content/uploads/blue-lock/002.webp",
      },
    ]);
  });
});
