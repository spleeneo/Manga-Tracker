import { describe, expect, it } from "vitest";
import { decorateSearchLibrary, sourceIdentity } from "@/lib/search-library";

describe("search library identity", () => {
  it("preserves Webtoon title numbers while ignoring tracking parameters", () => {
    const first = "https://www.webtoons.com/en/canvas/shared/list?title_no=101";
    const second = "https://www.webtoons.com/en/canvas/shared/list?title_no=202";
    expect(sourceIdentity(first)).not.toBe(sourceIdentity(second));
    expect(sourceIdentity(first)).toBe(sourceIdentity(`${first}&utm_source=test`));
    expect(decorateSearchLibrary([{ title: "Shared", sources: [{ name: "Webtoon", url: second }] }], [{ manga: { slug: "first", sources: [{ sourceUrl: first }] } }])[0].isTracked).toBe(false);
  });
  it("matches MangaDex ids despite optional title slugs without merging unrelated same-title works", () => {
    const results = decorateSearchLibrary([
      { title: "Noise", sources: [{ name: "MangaDex", url: "https://mangadex.org/title/id" }] },
      { title: "Noise", sources: [{ name: "MangaDex", url: "https://mangadex.org/title/other" }] },
    ], [{ manga: { slug: "noise", sources: [{ sourceUrl: "https://mangadex.org/title/id/noise" }] } }]);
    expect(results[0]).toMatchObject({ isTracked: true, librarySlug: "noise" });
    expect(results[1].isTracked).toBe(false);
  });
});
