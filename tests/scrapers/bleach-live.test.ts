import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { BleachLiveScraper } from "@/lib/scrapers/bleach-live";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

const homeHtml = `
  <meta name="description" content="Read Bleach Manga Online in High Quality"/>
  <meta name="twitter:image" content="https://bleach.live/wp-content/uploads/2022/11/cover.jpg" />
  <ul>
    <li><a href="https://w42.bleach.live/manga/bleach-chapter-687/">Bleach, Chapter 687</a></li>
    <li><a href="https://w42.bleach.live/manga/bleach-chapter-107-5/">Bleach, Chapter 107.5</a></li>
    <li><a href="https://w42.bleach.live/manga/bleach-chapter-1/">Bleach, Chapter 1</a></li>
    <li><a href="https://w42.bleach.live/manga/bleach-chapter-1/">Bleach, Chapter 1</a></li>
  </ul>
`;

describe("BleachLiveScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a focused Bleach result for Bleach queries", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(homeHtml));

    const scraper = new BleachLiveScraper();
    const results = await scraper.search("bleach");

    expect(results).toEqual([{
      title: "Bleach",
      description: "Read Bleach Manga Online in High Quality",
      coverUrl: "https://bleach.live/wp-content/uploads/2022/11/cover.jpg",
      status: "COMPLETED",
      author: "Tite Kubo",
      sourceUrl: "https://w42.bleach.live/",
      sourceName: "Bleach Live",
    }]);
  });

  it("extracts indexed chapters including decimal chapters without duplicates", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(homeHtml));

    const scraper = new BleachLiveScraper();
    const chapters = await scraper.fetchChapters("https://w42.bleach.live/");

    expect(chapters).toEqual([
      {
        providerChapterId: "687",
        chapterNumber: 687,
        title: "Bleach, Chapter 687",
        url: "https://w42.bleach.live/manga/bleach-chapter-687/",
      },
      {
        providerChapterId: "107.5",
        chapterNumber: 107.5,
        title: "Bleach, Chapter 107.5",
        url: "https://w42.bleach.live/manga/bleach-chapter-107-5/",
      },
      {
        providerChapterId: "1",
        chapterNumber: 1,
        title: "Bleach, Chapter 1",
        url: "https://w42.bleach.live/manga/bleach-chapter-1/",
      },
    ]);
  });

  it("maps public content images for the reader when available", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <main class="entry-content">
        <img src="https://w42.bleach.live/wp-content/uploads/bleach/001.jpg" />
        <img src="https://w42.bleach.live/wp-content/uploads/bleach/002.jpg" />
        <img src="https://w42.bleach.live/wp-content/uploads/bleach/003.jpg" />
        <img src="https://w42.bleach.live/wp-content/themes/toivo-lite/logo.png" />
      </main>
    `));

    const scraper = new BleachLiveScraper();
    const result = await scraper.fetchReaderPages({
      id: "chapter-id",
      url: "https://w42.bleach.live/manga/bleach-chapter-1/",
      chapterNumber: 1,
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages).toEqual([
      { index: 0, imageUrl: "https://w42.bleach.live/wp-content/uploads/bleach/001.jpg" },
      { index: 1, imageUrl: "https://w42.bleach.live/wp-content/uploads/bleach/002.jpg" },
      { index: 2, imageUrl: "https://w42.bleach.live/wp-content/uploads/bleach/003.jpg" },
    ]);
  });

  it("falls back externally when no readable public pages are exposed", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <img src="https://w42.bleach.live/wp-content/uploads/2022/11/cover.jpg" />
    `));

    const scraper = new BleachLiveScraper();
    const result = await scraper.fetchReaderPages({
      id: "chapter-id",
      url: "https://w42.bleach.live/manga/bleach-chapter-1/",
      chapterNumber: 1,
    });

    expect(result.status).toBe("EXTERNAL_ONLY");
    expect(result.pages).toEqual([]);
  });
});
