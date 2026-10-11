import { describe, expect, it } from "vitest";
import { decorateSearchLibrary } from "@/lib/search-library";

describe("search library identity", () => {
  it("matches MangaDex ids despite optional title slugs without merging unrelated same-title works", () => {
    const results = decorateSearchLibrary([
      { title: "Noise", sources: [{ name: "MangaDex", url: "https://mangadex.org/title/id" }] },
      { title: "Noise", sources: [{ name: "MangaDex", url: "https://mangadex.org/title/other" }] },
    ], [{ manga: { slug: "noise", sources: [{ sourceUrl: "https://mangadex.org/title/id/noise" }] } }]);
    expect(results[0]).toMatchObject({ isTracked: true, librarySlug: "noise" });
    expect(results[1].isTracked).toBe(false);
  });
});
