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

  it("extracts Fire Punch chapters and lazy reader images", async () => {
    fetchWithRetryMock
      .mockResolvedValueOnce(textResponse(`
        <a href="../../comic/fire-punch-chapter-83/index.html">Fire Punch, Chapter 83</a>
        <a href="../../comic/fire-punch-chapter-0/index.html">Fire Punch, Chapter 0</a>
      `))
      .mockResolvedValueOnce(textResponse(`
        <img src="../../wp-content/uploads/2022/11/01-81.jpg" />
        <img src="../../wp-content/uploads/2022/11/02-80.jpg" data-lazy-src="https://firepunch.xyz/wp-content/uploads/2022/11/02-80.jpg" />
        <img src="https://firepunch.xyz/wp-content/uploads/2022/11/02-80.jpg" />
        <img src="../../wp-content/uploads/2022/11/03-79.jpg" />
      `));

    const scraper = new SingleMangaSiteScraper();
    const chapters = await scraper.fetchChapters("https://firepunch.xyz/tag/chapter-0/index.html");

    expect(chapters).toEqual([
      expect.objectContaining({
        providerChapterId: "83",
        chapterNumber: 83,
        url: "https://firepunch.xyz/comic/fire-punch-chapter-83/index.html",
      }),
      expect.objectContaining({
        providerChapterId: "0",
        chapterNumber: 0,
        url: "https://firepunch.xyz/comic/fire-punch-chapter-0/index.html",
      }),
    ]);

    const reader = await scraper.fetchReaderPages({
      id: "chapter-id",
      url: "https://firepunch.xyz/comic/fire-punch-chapter-83/index.html",
      chapterNumber: 83,
    });

    expect(reader.status).toBe("READABLE");
    expect(reader.pages.map((page) => page.imageUrl)).toEqual([
      "https://firepunch.xyz/wp-content/uploads/2022/11/01-81.jpg",
      "https://firepunch.xyz/wp-content/uploads/2022/11/02-80.jpg",
      "https://firepunch.xyz/wp-content/uploads/2022/11/03-79.jpg",
    ]);
  });

  it("extracts reader-looking CDN images without source-specific allowlists", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <img src="https://laiond.com/images/page-001.jpg" alt="Land of the Lustrous, Chapter 108 image 01" />
      <img src="https://laiond.com/images/page-002.jpg" alt="Land of the Lustrous, Chapter 108 image 02" />
    `));

    const scraper = new SingleMangaSiteScraper();
    const result = await scraper.fetchReaderPages({
      id: "chapter-id",
      url: "https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-108/",
      chapterNumber: 108,
    }, {
      id: "s1",
      sourceName: "Land of the Lustrous",
      sourceUrl: "https://w1.land-of-the-lustrous.online/",
    });

    expect(result.status).toBe("READABLE");
    expect(result.pages.map((page) => page.imageUrl)).toEqual([
      "https://laiond.com/images/page-001.jpg",
      "https://laiond.com/images/page-002.jpg",
    ]);
  });

  it("does not treat a couple of cover images as a readable chapter", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <img src="https://w42.bleach.live/wp-content/uploads/2022/11/cover.jpg" width="303" height="480" />
      <img src="https://w42.bleach.live/wp-content/uploads/2022/11/bonus-cover.jpg" width="325" height="512" />
    `));

    const scraper = new SingleMangaSiteScraper();
    const result = await scraper.fetchReaderPages({
      id: "chapter-id",
      url: "https://w42.bleach.live/manga/bleach-chapter-687/",
      chapterNumber: 687,
    }, {
      id: "s1",
      sourceName: "Bleach Live",
      sourceUrl: "https://w42.bleach.live/",
    });

    expect(result.status).toBe("EXTERNAL_ONLY");
    expect(result.pages).toEqual([]);
  });

  it("probes a small set of likely dedicated domains when no config exists", async () => {
    fetchWithRetryMock.mockImplementation(async (url: string) => {
      if (url === "https://w45.sakamoto-days-manga.com/") {
        return textResponse(`
          <title>Sakamoto Days Manga Online</title>
          <meta name="description" content="Read Sakamoto Days manga online." />
          <meta property="og:image" content="https://w45.sakamoto-days-manga.com/wp-content/uploads/sakamoto.jpg" />
          <a href="/manga/sakamoto-days-chapter-1/">Sakamoto Days Chapter 1</a>
        `);
      }

      throw new Error("not found");
    });

    const scraper = new SingleMangaSiteScraper();
    const results = await scraper.search("sakamoto days");

    expect(results).toEqual([{
      title: "Sakamoto Days",
      description: "Read Sakamoto Days manga online.",
      coverUrl: "https://w45.sakamoto-days-manga.com/wp-content/uploads/sakamoto.jpg",
      status: undefined,
      author: undefined,
      sourceUrl: "https://w45.sakamoto-days-manga.com/",
      sourceName: "Sakamoto Days Manga",
    }]);
  });

  it("probes direct xyz chapter-index sites during background discovery", async () => {
    fetchWithRetryMock.mockImplementation(async (url: string) => {
      if (url === "https://fireforce.xyz/tag/chapter-0/index.html") {
        return textResponse(`
          <title>Fire Force Manga Online</title>
          <meta name="description" content="Read Fire Force manga online." />
          <a href="/comic/fire-force-chapter-1/index.html">Fire Force Chapter 1</a>
        `);
      }

      throw new Error("not found");
    });

    const scraper = new SingleMangaSiteScraper();
    const results = await scraper.discoverBackgroundSources("fire force");

    expect(results).toEqual([{
      title: "Fire Force",
      description: "Read Fire Force manga online.",
      coverUrl: undefined,
      status: undefined,
      author: undefined,
      sourceUrl: "https://fireforce.xyz/tag/chapter-0/index.html",
      sourceName: "Fire Force Manga",
    }]);
  });

  it("uses stored source names to parse compact direct domains after discovery", async () => {
    fetchWithRetryMock
      .mockResolvedValueOnce(textResponse(`
        <a href="/comic/fire-force-chapter-2/index.html">Fire Force Chapter 2</a>
      `))
      .mockResolvedValueOnce(textResponse(`
        <img src="/images/001.jpg" data-original-width="1267" data-original-height="1900" />
        <img src="/images/002.jpg" data-original-width="1267" data-original-height="1900" />
        <img src="/images/003.jpg" data-original-width="1267" data-original-height="1900" />
      `));

    const scraper = new SingleMangaSiteScraper();
    const chapters = await scraper.fetchChapters("https://fireforce.xyz/tag/chapter-0/index.html", {
      id: "s1",
      sourceName: "Fire Force Manga",
      sourceUrl: "https://fireforce.xyz/tag/chapter-0/index.html",
    });

    expect(chapters).toEqual([expect.objectContaining({
      chapterNumber: 2,
      url: "https://fireforce.xyz/comic/fire-force-chapter-2/index.html",
    })]);

    const reader = await scraper.fetchReaderPages({
      id: "chapter-id",
      url: "https://fireforce.xyz/comic/fire-force-chapter-2/index.html",
      chapterNumber: 2,
    }, {
      id: "s1",
      sourceName: "Fire Force Manga",
      sourceUrl: "https://fireforce.xyz/tag/chapter-0/index.html",
    });

    expect(reader.status).toBe("READABLE");
    expect(reader.pages.map((page) => page.imageUrl)).toEqual([
      "https://fireforce.xyz/images/001.jpg",
      "https://fireforce.xyz/images/002.jpg",
      "https://fireforce.xyz/images/003.jpg",
    ]);
  });
});
