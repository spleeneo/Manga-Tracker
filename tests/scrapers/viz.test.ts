import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { VizScraper } from "@/lib/scrapers/viz";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("VizScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches the public VIZ series index", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      var series_suggestions = [
        {"title":"Naruto","subtitle":"The epic adventures of the world's greatest ninja!","vanityurl":"naruto"},
        {"title":"One Piece","subtitle":"Pirate adventure.","vanityurl":"one-piece"}
      ];
    `));

    const scraper = new VizScraper();
    const results = await scraper.search("naruto");

    expect(results).toEqual([
      {
        title: "Naruto",
        description: "The epic adventures of the world's greatest ninja!",
        sourceUrl: "https://www.viz.com/naruto",
        sourceName: "VIZ",
      },
    ]);
  });

  it("extracts metadata from a VIZ series page", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <meta property="og:title" content="VIZ: The Official Website for Naruto">
      <meta property="og:description" content="Fallback description">
      <meta property="og:image" content="https://example.com/naruto.jpg">
      <section id="series-intro">
        <h2 id="page_title">Naruto</h2>
        <span>Created by Masashi Kishimoto</span>
        <p>Naruto wants to become the greatest ninja.</p>
      </section>
    `));

    const scraper = new VizScraper();
    const metadata = await scraper.fetchMetadata("https://www.viz.com/naruto");

    expect(metadata).toEqual({
      title: "Naruto",
      description: "Naruto wants to become the greatest ninja.",
      coverUrl: "https://example.com/naruto.jpg",
      author: "Masashi Kishimoto",
    });
  });

  it("returns public read links only when chapter numbers are exposed", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <a href="/read/manga/example/chapter-1?action=read">Chapter 1</a>
      <a href="/manga-books/example/product/123">Volume 1</a>
      <a href="/read/manga/example/chapter-2?action=read">Read chapter 2</a>
    `));

    const scraper = new VizScraper();
    const chapters = await scraper.fetchChapters("https://www.viz.com/example");

    expect(chapters).toEqual([
      {
        chapterNumber: 2,
        title: "Read chapter 2",
        url: "https://www.viz.com/read/manga/example/chapter-2?action=read",
      },
      {
        chapterNumber: 1,
        title: "Chapter 1",
        url: "https://www.viz.com/read/manga/example/chapter-1?action=read",
      },
    ]);
  });
});
