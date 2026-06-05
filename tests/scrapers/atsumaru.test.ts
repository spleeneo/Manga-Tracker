import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { AtsumaruScraper } from "@/lib/scrapers/atsumaru";
import { scrapeChapters } from "@/lib/scrapers/registry";

function jsonResponse(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("AtsumaruScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles Atsumaru reader and manga URLs", () => {
    const scraper = new AtsumaruScraper();

    expect(scraper.canHandle("https://atsu.moe/read/nh6Ii/Fqt0r#rs=f:0.1")).toBe(true);
    expect(scraper.canHandle("https://atsu.moe/manga/nh6Ii")).toBe(true);
  });

  it("fetches metadata from the Atsumaru manga page endpoint", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(jsonResponse({
      mangaPage: {
        title: "ONE-PUNCH MAN",
        description: "Hero for fun.",
        status: "releasing",
        poster: { url: "/static/poster.jpg" },
        authors: [
          { name: "ONE", type: "Author" },
          { name: "Yuusuke Murata", type: "Artist" },
        ],
      },
    }));

    const metadata = await new AtsumaruScraper().fetchMetadata("https://atsu.moe/read/nh6Ii/Fqt0r");

    expect(metadata).toEqual({
      title: "ONE-PUNCH MAN",
      description: "Hero for fun.",
      status: "releasing",
      coverUrl: "https://atsu.moe/static/poster.jpg",
      author: "ONE, Yuusuke Murata",
    });
    expect(fetchWithRetryMock).toHaveBeenCalledWith(
      "https://atsu.moe/api/manga/page?id=nh6Ii",
      expect.any(Object),
    );
  });

  it("merges the linked reader chapter with listed chapters", async () => {
    fetchWithRetryMock
      .mockResolvedValueOnce(jsonResponse({
        chapters: [
          { id: "chapter-231", title: "Chapter 231", number: 231, createdAt: 1779332970616 },
          { id: "chapter-230", title: "Chapter 230", number: 230, createdAt: "2026-05-01T00:00:00.000Z" },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({
        readChapter: {
          id: "Fqt0r",
          title: "Mag Version 232",
          pages: [{ image: "/static/pages/manga/Fqt0r/0.webp" }],
        },
      }));

    const chapters = await new AtsumaruScraper().fetchChapters("https://atsu.moe/read/nh6Ii/Fqt0r#rs=f:0.1");

    expect(chapters).toEqual([
      expect.objectContaining({
        providerChapterId: "Fqt0r",
        chapterNumber: 232,
        title: "Mag Version 232",
        url: "https://atsu.moe/read/nh6Ii/Fqt0r",
      }),
      expect.objectContaining({
        providerChapterId: "chapter-231",
        chapterNumber: 231,
        url: "https://atsu.moe/read/nh6Ii/chapter-231",
      }),
      expect.objectContaining({
        providerChapterId: "chapter-230",
        chapterNumber: 230,
      }),
    ]);
  });

  it("is selected by the registry for Atsumaru URLs", async () => {
    fetchWithRetryMock
      .mockResolvedValueOnce(jsonResponse({
        chapters: [
          { id: "chapter-231", title: "Chapter 231", number: 231 },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({
        readChapter: {
          id: "Fqt0r",
          title: "Mag Version 232",
          pages: [{ image: "/static/pages/manga/Fqt0r/0.webp" }],
        },
      }));

    const chapters = await scrapeChapters("https://atsu.moe/read/nh6Ii/Fqt0r#rs=f:0.1", {
      id: "source-id",
      sourceName: "Atsumaru",
      sourceUrl: "https://atsu.moe/read/nh6Ii/Fqt0r#rs=f:0.1",
    });

    expect(chapters[0]).toEqual(expect.objectContaining({
      providerChapterId: "Fqt0r",
      chapterNumber: 232,
    }));
  });

  it("maps Atsumaru reader pages for the in-app reader", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(jsonResponse({
      readChapter: {
        id: "Fqt0r",
        title: "Mag Version 232",
        pages: [
          { image: "/static/pages/scan/Fqt0r/0.webp", number: 0, width: 1200, height: 1707 },
          { image: "https://cdn.example/page-1.webp", number: 1 },
        ],
      },
    }));

    const result = await new AtsumaruScraper().fetchReaderPages({
      id: "chapter-id",
      providerChapterId: "Fqt0r",
      chapterNumber: 232,
      url: "https://atsu.moe/read/nh6Ii/Fqt0r",
    }, {
      id: "source-id",
      sourceName: "Atsumaru",
      sourceUrl: "https://atsu.moe/read/nh6Ii/Fqt0r",
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages).toEqual([
      {
        index: 0,
        imageUrl: "https://atsu.moe/static/pages/scan/Fqt0r/0.webp",
        width: 1200,
        height: 1707,
      },
      {
        index: 1,
        imageUrl: "https://cdn.example/page-1.webp",
      },
    ]);
  });
});
