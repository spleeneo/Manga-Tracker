import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { ComikeyScraper } from "@/lib/scrapers/comikey";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

function jsonResponse(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  };
}

const comicJson = {
  id: 10,
  link: "/comics/kengan-omega-manga/10/",
  name: "Kengan Omega",
  uslug: "kengan-omega-manga",
  author: [{ name: "SANDROVICH Yabako" }],
  artist: [{ name: "Daromeon" }],
  description: "Two years after the events of Kengan Ashura.",
  excerpt: "Two beasts are facing off.",
  format: 1,
  cover: "/media/comics/WeRbe0/cover.png",
  removed: false,
};

function comicPage(extra = "") {
  return `
    <meta property="og:image" content="https://media.comikey.com/fallback.png">
    <script id="comic" type="application/json">${JSON.stringify(comicJson)}</script>
    ${extra}
  `;
}

describe("ComikeyScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches Comikey public comic listings", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <li class="item-full-row item-mini item-preview">
        <a class="image-wrap" href="https://comikey.com/comics/kengan-omega-manga/10/">
          <img src="https://media.comikey.com/gazo/240/webp/comics/kengan.png" alt="Thumbnail for Kengan Omega">
        </a>
        <span class="title">
          <a href="https://comikey.com/comics/kengan-omega-manga/10/">Kengan Omega</a>
        </span>
        <span class="subtitle">by <a>SANDROVICH Yabako</a> | <a>Daromeon</a></span>
      </li>
    `));

    const scraper = new ComikeyScraper();
    const results = await scraper.search("kengan");

    expect(results).toEqual([
      {
        title: "Kengan Omega",
        sourceUrl: "https://comikey.com/comics/kengan-omega-manga/10/",
        sourceName: "Comikey",
        coverUrl: "https://media.comikey.com/gazo/240/webp/comics/kengan.png",
        author: "SANDROVICH Yabako | Daromeon",
      },
    ]);
  });

  it("extracts metadata from embedded Comikey comic JSON", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(comicPage()));

    const scraper = new ComikeyScraper();
    const metadata = await scraper.fetchMetadata("https://comikey.com/comics/kengan-omega-manga/10/");

    expect(metadata).toEqual({
      title: "Kengan Omega",
      description: "Two years after the events of Kengan Ashura.",
      coverUrl: "https://comikey.com/media/comics/WeRbe0/cover.png",
      status: "ONGOING",
      author: "SANDROVICH Yabako | Daromeon",
    });
  });

  it("normalizes removed Comikey titles as completed", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(comicPage(`
      <script id="unused" type="application/json">{}</script>
    `).replace('"removed":false', '"removed":true')));

    const scraper = new ComikeyScraper();
    const metadata = await scraper.fetchMetadata("https://comikey.com/comics/kengan-omega-manga/10/");

    expect(metadata.status).toBe("COMPLETED");
  });

  it("fetches public episode metadata as external chapter links", async () => {
    fetchWithRetryMock
      .mockResolvedValueOnce(textResponse(comicPage()))
      .mockResolvedValueOnce(jsonResponse({
        episodes: [
          {
            id: "EPI-kEvQXD",
            number: 1,
            releasedAt: "2021-09-29T14:50:00Z",
            title: "Chapter 1",
            subtitle: "Kengan Matches",
          },
          {
            id: "EPI-oLgAmR",
            number: 355,
            releasedAt: "2026-05-20T15:00:00Z",
            title: "Chapter 355",
            subtitle: "Arashiyama vs. Toa",
          },
        ],
      }));

    const scraper = new ComikeyScraper();
    const chapters = await scraper.fetchChapters("https://comikey.com/comics/kengan-omega-manga/10/");

    expect(chapters).toEqual([
      {
        providerChapterId: "EPI-oLgAmR",
        chapterNumber: 355,
        title: "Chapter 355: Arashiyama vs. Toa",
        url: "https://comikey.com/read/kengan-omega-manga/oLgAmR/chapter-355/",
        releaseDate: new Date("2026-05-20T15:00:00Z"),
      },
      {
        providerChapterId: "EPI-kEvQXD",
        chapterNumber: 1,
        title: "Chapter 1: Kengan Matches",
        url: "https://comikey.com/read/kengan-omega-manga/kEvQXD/chapter-1/",
        releaseDate: new Date("2021-09-29T14:50:00Z"),
      },
    ]);
  });
});
