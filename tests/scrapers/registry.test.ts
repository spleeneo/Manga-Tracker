import { afterEach, describe, expect, it, vi } from "vitest";
import { getRegisteredScrapers, searchScrapers } from "@/lib/scrapers/registry";

describe("scraper search aggregation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges known title aliases into one manga result", async () => {
    const providers = getRegisteredScrapers();
    providers.forEach((provider) => {
      vi.spyOn(provider, "search").mockResolvedValue([]);
    });

    vi.mocked(providers[0].search).mockResolvedValue([{
      title: "Witch Hat Atelier",
      sourceName: "Witch Hat Atelier Manga",
      sourceUrl: "https://witchhatateliermanga.com/",
    }]);
    vi.mocked(providers[1].search).mockResolvedValue([{
      title: "Tongari Booshi no Atorie",
      sourceName: "MangaDex",
      sourceUrl: "https://mangadex.org/title/example",
    }]);

    const results = await searchScrapers("witch hat atelier");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      title: "Witch Hat Atelier",
      sources: [
        { name: "Witch Hat Atelier Manga", url: "https://witchhatateliermanga.com/" },
        { name: "MangaDex", url: "https://mangadex.org/title/example" },
      ],
    }));
  });
});
