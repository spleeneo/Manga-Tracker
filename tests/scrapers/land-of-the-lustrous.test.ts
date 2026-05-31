import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { LandOfTheLustrousScraper } from "@/lib/scrapers/land-of-the-lustrous";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

const homeHtml = `
  <meta name="description" content="Read Land of the Lustrous Manga Online in High Quality"/>
  <meta name="twitter:image" content="https://land-of-the-lustrous.online/wp-content/uploads/2023/12/cover.jpg" />
  <ul>
    <li><a href="https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-108/">Land of the Lustrous, Chapter 108</a></li>
    <li><a href="https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-27-5/">Land of the Lustrous, Chapter 27.5</a></li>
    <li><a href="https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-1/">Land of the Lustrous, Chapter 1</a></li>
    <li><a href="https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-1/">Land of the Lustrous, Chapter 1</a></li>
  </ul>
`;

describe("LandOfTheLustrousScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a focused Houseki no Kuni result for alias queries", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(homeHtml));

    const scraper = new LandOfTheLustrousScraper();
    const results = await scraper.search("houseki no kuni");

    expect(results).toEqual([{
      title: "Houseki no Kuni",
      description: "Read Land of the Lustrous Manga Online in High Quality",
      coverUrl: "https://land-of-the-lustrous.online/wp-content/uploads/2023/12/cover.jpg",
      status: "COMPLETED",
      author: "Haruko Ichikawa",
      sourceUrl: "https://w1.land-of-the-lustrous.online/",
      sourceName: "Land of the Lustrous",
    }]);
  });

  it("extracts indexed chapters from the home page", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(homeHtml));

    const scraper = new LandOfTheLustrousScraper();
    const chapters = await scraper.fetchChapters("https://w1.land-of-the-lustrous.online/");

    expect(chapters).toEqual([
      {
        providerChapterId: "108",
        chapterNumber: 108,
        title: "Land of the Lustrous, Chapter 108",
        url: "https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-108/",
      },
      {
        providerChapterId: "27.5",
        chapterNumber: 27.5,
        title: "Land of the Lustrous, Chapter 27.5",
        url: "https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-27-5/",
      },
      {
        providerChapterId: "1",
        chapterNumber: 1,
        title: "Land of the Lustrous, Chapter 1",
        url: "https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-1/",
      },
    ]);
  });

  it("maps public page images for the in-app reader", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <main class="entry-content">
        <img src="https://land-of-the-lustrous.online/wp-content/uploads/2023/12/page-001.jpg" />
        <img src="https://w1.land-of-the-lustrous.online/wp-content/uploads/2023/12/page-002.webp" />
        <img src="https://w1.land-of-the-lustrous.online/wp-includes/images/icon.png" />
      </main>
    `));

    const scraper = new LandOfTheLustrousScraper();
    const result = await scraper.fetchReaderPages({
      id: "chapter-id",
      url: "https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-1/",
      chapterNumber: 1,
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages).toEqual([
      { index: 0, imageUrl: "https://land-of-the-lustrous.online/wp-content/uploads/2023/12/page-001.jpg" },
      { index: 1, imageUrl: "https://w1.land-of-the-lustrous.online/wp-content/uploads/2023/12/page-002.webp" },
    ]);
  });
});
