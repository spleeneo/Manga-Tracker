import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Scraper } from "@/lib/scrapers/types";

const { getRegisteredScrapers } = vi.hoisted(() => ({
  getRegisteredScrapers: vi.fn(),
}));

vi.mock("@/lib/scrapers/registry", () => ({
  getRegisteredScrapers,
}));

import { discoverMissingSourcesForManga, isSearchResultForManga } from "@/lib/source-discovery";

function scraper(overrides: Partial<Scraper>): Scraper {
  return {
    name: "Provider",
    capabilities: { search: true, metadata: true, chapters: true },
    canHandle: vi.fn(() => false),
    search: vi.fn().mockResolvedValue([]),
    fetchChapters: vi.fn(),
    fetchMetadata: vi.fn(),
    ...overrides,
  } as Scraper;
}

describe("source discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRegisteredScrapers.mockReturnValue([]);
  });

  it("accepts exact provider URL slugs when MangaPill appends alternate titles", () => {
    expect(isSearchResultForManga(
      { title: "Choujin X", slug: "choujin-x" },
      {
        title: "Choujin X Overhuman X",
        sourceUrl: "https://mangapill.com/manga/5454/choujin-x",
      },
    )).toBe(true);
  });

  it("rejects same-title matches when both sides expose conflicting authors", () => {
    expect(isSearchResultForManga(
      { title: "NOiSE", slug: "noise", author: "Tsutomu Nihei" },
      {
        title: "Noise",
        author: "Tetsuya Tsutsui",
        sourceUrl: "https://example.test/manga/noise",
      },
    )).toBe(false);
  });

  it("requires author evidence before auto-linking short ambiguous titles", () => {
    expect(isSearchResultForManga(
      { title: "NOiSE", slug: "noise", author: "Tsutomu Nihei" },
      {
        title: "Noise",
        sourceUrl: "https://example.test/manga/noise",
      },
    )).toBe(false);

    expect(isSearchResultForManga(
      { title: "NOiSE", slug: "noise", author: "Tsutomu Nihei" },
      {
        title: "Noise",
        author: "Nihei Tsutomu",
        sourceUrl: "https://example.test/manga/noise",
      },
    )).toBe(true);
  });

  it("discovers a missing registered source for already tracked manga", async () => {
    const search = vi.fn().mockResolvedValue([
      {
        title: "Dandadan",
        sourceName: "FutureProvider",
        sourceUrl: "https://future.example/manga/dandadan",
      },
    ]);
    getRegisteredScrapers.mockReturnValue([
      scraper({
        name: "MangaDex",
        canHandle: vi.fn((url) => url.includes("mangadex.org")),
      }),
      scraper({
        name: "FutureProvider",
        canHandle: vi.fn((url) => url.includes("future.example")),
        search,
      }),
    ]);

    const discovered = await discoverMissingSourcesForManga(
      { title: "Dandadan", slug: "dandadan" },
      [{ sourceName: "MangaDex", sourceUrl: "https://mangadex.org/title/x" }],
    );

    expect(search).toHaveBeenCalledWith("Dandadan");
    expect(discovered).toEqual([
      expect.objectContaining({
        sourceName: "FutureProvider",
        sourceUrl: "https://future.example/manga/dandadan",
      }),
    ]);
  });

  it("does not rediscover a source handled by an existing provider URL", async () => {
    const search = vi.fn().mockResolvedValue([
      {
        title: "Dandadan",
        sourceName: "MangaPill",
        sourceUrl: "https://mangapill.com/manga/5460/dandadan",
      },
    ]);
    getRegisteredScrapers.mockReturnValue([
      scraper({
        name: "MangaPill",
        canHandle: vi.fn((url) => url.includes("mangapill.com")),
        search,
      }),
    ]);

    const discovered = await discoverMissingSourcesForManga(
      { title: "Dandadan", slug: "dandadan" },
      [{ sourceName: "MangaPill", sourceUrl: "https://mangapill.com/manga/5460/dandadan" }],
    );

    expect(search).not.toHaveBeenCalled();
    expect(discovered).toEqual([]);
  });
});
