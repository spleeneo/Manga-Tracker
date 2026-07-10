import { describe, expect, it } from "vitest";
import {
  mergeBrowseDisplayResults,
  normalizeBrowseExploreResult,
  normalizeSearchExploreResult,
} from "@/lib/explore/ui-results";

describe("explore UI result normalization", () => {
  it("normalizes MangaDex browse results into shared card data", () => {
    const result = normalizeBrowseExploreResult({
      id: "md1",
      title: "One Piece",
      slug: "one-piece",
      description: "Pirates",
      coverUrl: "cover.jpg",
      status: "ONGOING",
      year: 1997,
      tags: [{ id: "tag1", name: "Action" }],
      source: { name: "MangaDex", url: "https://mangadex.org/title/md1" },
      isTracked: true,
    });

    expect(result).toEqual(expect.objectContaining({
      id: "md1",
      resultKind: "browse",
      sources: [{ name: "MangaDex", url: "https://mangadex.org/title/md1" }],
      isTracked: true,
    }));
  });

  it("normalizes aggregated search results with all returned sources", () => {
    const result = normalizeSearchExploreResult({
      title: "Witch Hat Atelier",
      description: "Magic and craft.",
      coverUrl: "cover.jpg",
      status: "ONGOING",
      sources: [
        { name: "MangaDex", url: "https://mangadex.org/title/witch-hat" },
        { name: "Comikey", url: "https://comikey.com/comics/witch-hat-atelier" },
      ],
    });

    expect(result).toEqual(expect.objectContaining({
      id: "search:https://mangadex.org/title/witch-hat",
      title: "Witch Hat Atelier",
      slug: "witch-hat-atelier",
      resultKind: "search",
      isTracked: false,
      sources: [
        { name: "MangaDex", url: "https://mangadex.org/title/witch-hat" },
        { name: "Comikey", url: "https://comikey.com/comics/witch-hat-atelier" },
      ],
    }));
  });

  it("interleaves merged browse providers while combining duplicate titles", () => {
    const mangaPill = [
      normalizeBrowseExploreResult({
        id: "mp1",
        title: "Alpha",
        slug: "alpha",
        tags: [],
        source: { name: "MangaPill", url: "https://mangapill.com/manga/1/alpha" },
        isTracked: false,
      }),
      normalizeBrowseExploreResult({
        id: "mp2",
        title: "Shared",
        slug: "shared",
        tags: [{ id: "mangapill:action", name: "Action" }],
        source: { name: "MangaPill", url: "https://mangapill.com/manga/2/shared" },
        isTracked: false,
      }),
    ];
    const mangaDex = [
      normalizeBrowseExploreResult({
        id: "md1",
        title: "Beta",
        slug: "beta",
        tags: [],
        source: { name: "MangaDex", url: "https://mangadex.org/title/beta" },
        isTracked: false,
      }),
      normalizeBrowseExploreResult({
        id: "md2",
        title: "Shared",
        slug: "shared",
        tags: [{ id: "mangadex:action", name: "Action" }],
        source: { name: "MangaDex", url: "https://mangadex.org/title/shared" },
        isTracked: true,
      }),
    ];

    const merged = mergeBrowseDisplayResults(mangaPill, mangaDex);

    expect(merged.map((manga) => manga.title)).toEqual(["Alpha", "Beta", "Shared"]);
    expect(merged.map((manga) => manga.sources[0].name)).toEqual(["MangaPill", "MangaDex", "MangaPill"]);
    expect(merged[2]).toEqual(expect.objectContaining({
      isTracked: true,
      sources: [
        { name: "MangaPill", url: "https://mangapill.com/manga/2/shared" },
        { name: "MangaDex", url: "https://mangadex.org/title/shared" },
      ],
    }));
  });
});
