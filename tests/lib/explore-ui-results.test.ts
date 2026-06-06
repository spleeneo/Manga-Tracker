import { describe, expect, it } from "vitest";
import {
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
});
