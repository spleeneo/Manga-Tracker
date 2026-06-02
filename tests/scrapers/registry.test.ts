import { afterEach, describe, expect, it, vi } from "vitest";
import { getRegisteredScrapers, searchScrapers } from "@/lib/scrapers/registry";

describe("scraper search aggregation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges known title aliases and keeps the dedicated source when present", async () => {
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
      ],
    }));
  });

  it("merges search hits that point to the same source URL", async () => {
    const providers = getRegisteredScrapers();
    providers.forEach((provider) => {
      vi.spyOn(provider, "search").mockResolvedValue([]);
    });

    vi.mocked(providers[1].search).mockResolvedValue([{
      title: "English Title",
      sourceName: "MangaDex",
      sourceUrl: "https://mangadex.org/title/same-manga",
      description: "Primary metadata",
    }]);
    vi.mocked(providers[2].search).mockResolvedValue([{
      title: "Japanese Romaji Title",
      sourceName: "MangaDex",
      sourceUrl: "https://mangadex.org/title/same-manga",
    }]);

    const results = await searchScrapers("same manga");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      title: "English Title",
      description: "Primary metadata",
      sources: [
        { name: "MangaDex", url: "https://mangadex.org/title/same-manga" },
      ],
    }));
  });
});
