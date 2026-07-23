import { afterEach, describe, expect, it, vi } from "vitest";
import { getRegisteredScrapers, searchScrapers } from "@/lib/scrapers/registry";

describe("scraper search aggregation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges known title aliases and keeps all matched sources", async () => {
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

  it("prioritizes MangaPill in aggregated discovery results", async () => {
    const providers = getRegisteredScrapers();
    providers.forEach((provider) => {
      vi.spyOn(provider, "search").mockResolvedValue([]);
    });

    const mangaDex = providers.find((provider) => provider.name === "MangaDex");
    const mangaPill = providers.find((provider) => provider.name === "MangaPill");
    const manganato = providers.find((provider) => provider.name === "Manganato");
    expect(mangaDex).toBeDefined();
    expect(mangaPill).toBeDefined();
    expect(manganato).toBeDefined();

    vi.mocked(mangaDex!.search).mockResolvedValue([{
      title: "One Piece",
      sourceName: "MangaDex",
      sourceUrl: "https://mangadex.org/title/one-piece",
      coverUrl: "https://uploads.mangadex.org/covers/one-piece.jpg",
    }]);
    vi.mocked(mangaPill!.search).mockResolvedValue([{
      title: "One Piece",
      sourceName: "MangaPill",
      sourceUrl: "https://mangapill.com/manga/2/one-piece",
      coverUrl: "https://cdn.readdetectiveconan.com/file/mangapill/i/2.webp",
    }]);
    vi.mocked(manganato!.search).mockResolvedValue([{
      title: "Lower Priority Match",
      sourceName: "Manganato",
      sourceUrl: "https://manganato.com/manga/example",
    }]);

    const results = await searchScrapers("one piece");

    expect(results[0]).toEqual(expect.objectContaining({
      title: "One Piece",
      coverUrl: "https://cdn.readdetectiveconan.com/file/mangapill/i/2.webp",
      sources: [
        { name: "MangaPill", url: "https://mangapill.com/manga/2/one-piece" },
        { name: "MangaDex", url: "https://mangadex.org/title/one-piece" },
      ],
    }));
  });

  it("keeps ambiguous same-title manga separate unless identity evidence links them", async () => {
    const providers = getRegisteredScrapers();
    providers.forEach((provider) => {
      vi.spyOn(provider, "search").mockResolvedValue([]);
    });

    const mangaDex = providers.find((provider) => provider.name === "MangaDex");
    const mangaPill = providers.find((provider) => provider.name === "MangaPill");
    const neloManga = providers.find((provider) => provider.name === "NeloManga");
    expect(mangaDex).toBeDefined();
    expect(mangaPill).toBeDefined();
    expect(neloManga).toBeDefined();

    vi.mocked(mangaPill!.search).mockResolvedValue([{
      title: "NOiSE",
      sourceName: "MangaPill",
      sourceUrl: "https://mangapill.com/manga/3174/noise",
    }]);
    vi.mocked(mangaDex!.search).mockResolvedValue([{
      title: "NOiSE",
      sourceName: "MangaDex",
      sourceUrl: "https://mangadex.org/title/9d6393a0-e651-496d-9c68-465b7ee5fad2",
    }]);
    vi.mocked(neloManga!.search).mockResolvedValue([{
      title: "Noise",
      sourceName: "NeloManga",
      sourceUrl: "https://www.nelomanga.net/manga/noise_44084",
      description: "Latest: Chapter 23",
    }]);

    const results = await searchScrapers("noise");

    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "NOiSE",
        sources: [
          { name: "MangaPill", url: "https://mangapill.com/manga/3174/noise" },
        ],
      }),
      expect.objectContaining({
        title: "Noise",
        description: "Latest: Chapter 23",
        sources: [
          { name: "NeloManga", url: "https://www.nelomanga.net/manga/noise_44084" },
        ],
      }),
    ]));
    expect(results.findIndex((result) => result.sources.some((source) => source.url === "https://www.nelomanga.net/manga/noise_44084"))).toBeLessThan(3);
  });
});
