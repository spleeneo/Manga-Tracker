import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { ManganatoScraper } from "@/lib/scrapers/manganato";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("ManganatoScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps public chapter images for the in-app reader", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <div class="container-chapter-reader">
        <img src="https://chapmanganato.to/manga/001.jpg" />
        <img data-src="https://mncdn.example/manga/002.png" />
        <img src="https://chapmanganato.to/logo.png" />
      </div>
    `));

    const scraper = new ManganatoScraper();
    const result = await scraper.fetchReaderPages({
      url: "https://chapmanganato.to/manga-aa/chapter-1",
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages).toEqual([
      { index: 0, imageUrl: "https://chapmanganato.to/manga/001.jpg" },
      { index: 1, imageUrl: "https://mncdn.example/manga/002.png" },
    ]);
  });

  it("falls back externally when no public chapter images are present", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <div><img src="https://chapmanganato.to/logo.png" /></div>
    `));

    const scraper = new ManganatoScraper();
    const result = await scraper.fetchReaderPages({
      url: "https://chapmanganato.to/manga-aa/chapter-1",
    });

    expect(result.status).toBe("EXTERNAL_ONLY");
    expect(result.pages).toEqual([]);
  });

  it("extracts completed status from story metadata", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <h1>Finished Story</h1>
      <span class="info-image"><img src="https://chapmanganato.to/cover.jpg"></span>
      <div class="panel-story-info-description">Description : A finished manga.</div>
      <li><h3>Status :</h3>Completed</li>
    `));

    const scraper = new ManganatoScraper();
    const metadata = await scraper.fetchMetadata("https://chapmanganato.to/manga-aa000000");

    expect(metadata.status).toBe("COMPLETED");
  });
});
