import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { WitchHatAtelierScraper } from "@/lib/scrapers/witch-hat-atelier";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

const homeHtml = `
  <meta name="description" content="Read Witch Hat Atelier Manga Online"/>
  <meta property="og:image" content="https://witchhatateliermanga.com/cover.jpg" />
  <h2>Synopsis:</h2>
  <ul><li>Coco wants to become a witch.</li></ul>
  <a href="https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-96/">New Chapter Chapter 96</a>
  <a href="https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-90-5/">Chapter 90.5 7 months ago</a>
  <a href="https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-1/">Chapter 1 1 year ago</a>
  <a href="https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-1/">Chapter 1 1 year ago</a>
`;

describe("WitchHatAtelierScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a focused Witch Hat Atelier result for matching queries", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(homeHtml));

    const scraper = new WitchHatAtelierScraper();
    const results = await scraper.search("witch hat atelier");

    expect(results).toEqual([{
      title: "Witch Hat Atelier",
      description: "Coco wants to become a witch.",
      coverUrl: "https://witchhatateliermanga.com/cover.jpg",
      status: "ONGOING",
      author: "Kamome Shirahama",
      sourceUrl: "https://witchhatateliermanga.com/",
      sourceName: "Witch Hat Atelier Manga",
    }]);
  });

  it("extracts indexed chapters including decimal chapters without duplicates", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(homeHtml));

    const scraper = new WitchHatAtelierScraper();
    const chapters = await scraper.fetchChapters("https://witchhatateliermanga.com/");

    expect(chapters).toEqual([
      {
        providerChapterId: "96",
        chapterNumber: 96,
        title: "New Chapter Chapter 96",
        url: "https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-96/",
      },
      {
        providerChapterId: "90.5",
        chapterNumber: 90.5,
        title: "Chapter 90.5 7 months ago",
        url: "https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-90-5/",
      },
      {
        providerChapterId: "1",
        chapterNumber: 1,
        title: "Chapter 1 1 year ago",
        url: "https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-1/",
      },
    ]);
  });

  it("maps public content images for the reader when available", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <img src="https://witchhatateliermanga.com/wp-content/uploads/2024/10/Tongari-Booshi-No-Atorie.jpg" />
      <img src="https://pic.readkakegurui.com/file/sancdn/witch-hat-atelier/chapter-96/1.webp" />
      <img src="https://pic.readkakegurui.com/file/sancdn/witch-hat-atelier/chapter-96/2.webp" />
    `));

    const scraper = new WitchHatAtelierScraper();
    const result = await scraper.fetchReaderPages({
      id: "chapter-id",
      url: "https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-96/",
      chapterNumber: 96,
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages).toEqual([
      { index: 0, imageUrl: "https://pic.readkakegurui.com/file/sancdn/witch-hat-atelier/chapter-96/1.webp" },
      { index: 1, imageUrl: "https://pic.readkakegurui.com/file/sancdn/witch-hat-atelier/chapter-96/2.webp" },
    ]);
  });
});
