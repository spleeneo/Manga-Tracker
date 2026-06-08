import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
  ScraperRequestError: class ScraperRequestError extends Error {
    constructor(message: string, public kind: string, public status?: number) {
      super(message);
    }
  },
}));

import { MangaPillScraper } from "@/lib/scrapers/mangapill";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("MangaPillScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles MangaPill manga URLs", () => {
    const scraper = new MangaPillScraper();

    expect(scraper.canHandle("https://mangapill.com/manga/5460/dandadan")).toBe(true);
    expect(scraper.canHandle("https://example.com/manga/5460/dandadan")).toBe(false);
  });

  it("extracts search results from MangaPill cards", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <a href="/manga/2/one-piece" class="relative block">
        <figure><img data-src="https://cdn.readdetectiveconan.com/file/mangapill/i/2.webp?h=abc" /></figure>
      </a>
      <a href="/manga/2/one-piece" class="mb-2">
        <div>One Piece</div>
      </a>
      <a href="/manga/5460/dandadan"><div>Dandadan</div></a>
    `));

    const scraper = new MangaPillScraper();
    const results = await scraper.search("one piece");

    expect(results).toEqual([
      {
        title: "One Piece",
        sourceUrl: "https://mangapill.com/manga/2/one-piece",
        sourceName: "MangaPill",
        coverUrl: "https://cdn.readdetectiveconan.com/file/mangapill/i/2.webp?h=abc",
      },
      {
        title: "Dandadan",
        sourceUrl: "https://mangapill.com/manga/5460/dandadan",
        sourceName: "MangaPill",
        coverUrl: undefined,
      },
    ]);
  });

  it("extracts metadata from manga pages", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <h1>Dandadan</h1>
      <img data-src="https://cdn.readdetectiveconan.com/file/mangapill/i/5460.webp?h=abc" alt="Dandadan">
      <p class="text-sm text--secondary">Ken Takakura doesn&#39;t believe in ghosts.<br/>(Source: Shueisha, translated)</p>
      <label>Type</label><div>manga</div>
      <label>Status</label><div>publishing</div>
    `));

    const scraper = new MangaPillScraper();
    const metadata = await scraper.fetchMetadata("https://mangapill.com/manga/5460/dandadan");

    expect(metadata).toEqual({
      title: "Dandadan",
      description: "Ken Takakura doesn't believe in ghosts.",
      coverUrl: "https://cdn.readdetectiveconan.com/file/mangapill/i/5460.webp?h=abc",
      status: "ONGOING",
    });
  });

  it("extracts and sorts full chapter lists including decimals", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <a href="/chapters/2-11183000/one-piece-chapter-1183">#1183</a>
      <a href="/chapters/2-11183500/one-piece-chapter-1183.5">#1183.5</a>
      <a href="/chapters/2-11184000/one-piece-chapter-1184">#1184</a>
      <a href="/chapters/2-11184000/one-piece-chapter-1184">duplicate</a>
    `));

    const scraper = new MangaPillScraper();
    const chapters = await scraper.fetchChapters("https://mangapill.com/manga/2/one-piece");

    expect(chapters).toEqual([
      {
        providerChapterId: "2-11184000/one-piece-chapter-1184",
        chapterNumber: 1184,
        title: "Chapter 1184",
        url: "https://mangapill.com/chapters/2-11184000/one-piece-chapter-1184",
      },
      {
        providerChapterId: "2-11183500/one-piece-chapter-1183.5",
        chapterNumber: 1183.5,
        title: "Chapter 1183.5",
        url: "https://mangapill.com/chapters/2-11183500/one-piece-chapter-1183.5",
      },
      {
        providerChapterId: "2-11183000/one-piece-chapter-1183",
        chapterNumber: 1183,
        title: "Chapter 1183",
        url: "https://mangapill.com/chapters/2-11183000/one-piece-chapter-1183",
      },
    ]);
  });

  it("returns proxied public reader images", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <img src="https://cdn.readdetectiveconan.com/file/mangap/2026/23/2/11184000/hash/1.jpeg" />
      <img data-src="https://cdn.readdetectiveconan.com/file/mangap/2026/23/2/11184000/hash/2.jpeg" />
      <img src="https://cdn.readdetectiveconan.com/file/mangapill/i/2.webp" />
    `));

    const scraper = new MangaPillScraper();
    const result = await scraper.fetchReaderPages({
      id: "c1",
      providerChapterId: "2-11184000",
      chapterNumber: 1184,
      title: "Chapter 1184",
      url: "https://mangapill.com/chapters/2-11184000/one-piece-chapter-1184",
    }, {
      id: "s1",
      sourceName: "MangaPill",
      sourceUrl: "https://mangapill.com/manga/2/one-piece",
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages).toEqual([
      {
        index: 0,
        imageUrl: "/api/proxy/image?url=https%3A%2F%2Fcdn.readdetectiveconan.com%2Ffile%2Fmangap%2F2026%2F23%2F2%2F11184000%2Fhash%2F1.jpeg&referer=https%3A%2F%2Fmangapill.com%2Fchapters%2F2-11184000%2Fone-piece-chapter-1184",
      },
      {
        index: 1,
        imageUrl: "/api/proxy/image?url=https%3A%2F%2Fcdn.readdetectiveconan.com%2Ffile%2Fmangap%2F2026%2F23%2F2%2F11184000%2Fhash%2F2.jpeg&referer=https%3A%2F%2Fmangapill.com%2Fchapters%2F2-11184000%2Fone-piece-chapter-1184",
      },
    ]);
  });
});
