import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { UrekMazinoScraper } from "@/lib/scrapers/urek-mazino";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

const homeHtml = `
  <meta name="description" content="Read Urek Mazino online.">
  <meta property="og:image" content="https://urekmazino.com/og-image.png">
  <script type="application/ld+json">
    {
      "@context":"https://schema.org",
      "@type":"ItemList",
      "itemListElement":[
        {"@type":"ListItem","position":1,"url":"https://urekmazino.com/chapter/1/","name":"Urek Mazino Chapter 1: Hollow One"},
        {"@type":"ListItem","position":2,"url":"https://urekmazino.com/chapter/64/","name":"Urek Mazino Chapter 64: The Hidden Well"},
        {"@type":"ListItem","position":3,"url":"https://urekmazino.com/chapter/65/","name":"Urek Mazino Chapter 65: Unreleased"}
      ]
    }
  </script>
  <script>
    window.__NUXT__ = {
      config: {
        public: {
          SITE_CONFIG: {
            main_page_display_title:"Urek Mazino: Tower of God",
            description:"Read Urek Mazino online."
          },
          LATEST_CHAPTER:{id:"64",releaseDate:"2026 May 12"},
          IS_FINISHED:false
        }
      }
    }
  </script>
`;

describe("UrekMazinoScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a focused search result for Urek Mazino queries", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(homeHtml));

    const scraper = new UrekMazinoScraper();
    const results = await scraper.search("tower of god urek");

    expect(results).toEqual([
      {
        title: "Urek Mazino: Tower of God",
        description: "Read Urek Mazino online.",
        coverUrl: "https://urekmazino.com/og-image.png",
        status: "ONGOING",
        author: "SIU",
        sourceUrl: "https://urekmazino.com",
        sourceName: "Urek Mazino",
      },
    ]);
  });

  it("extracts released chapters and skips unreleased placeholders", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(homeHtml));

    const scraper = new UrekMazinoScraper();
    const chapters = await scraper.fetchChapters("https://urekmazino.com/");

    expect(chapters).toEqual([
      {
        providerChapterId: "64",
        chapterNumber: 64,
        title: "Chapter 64: The Hidden Well",
        url: "https://urekmazino.com/chapter/64/",
        releaseDate: new Date("2026 May 12"),
      },
      {
        providerChapterId: "1",
        chapterNumber: 1,
        title: "Chapter 1: Hollow One",
        url: "https://urekmazino.com/chapter/1/",
        releaseDate: undefined,
      },
    ]);
  });
});
