import { describe, expect, it } from "vitest";
import { applySourceOverrideToInputSources, filterSourcesForManga, getMangaSourceOverride } from "@/lib/source-overrides";

describe("manga source overrides", () => {
  it("uses Land of the Lustrous as the only Houseki no Kuni source", () => {
    expect(getMangaSourceOverride({ slug: "houseki-no-kuni" })?.sourceName).toBe("Land of the Lustrous");

    expect(applySourceOverrideToInputSources({ title: "Houseki no Kuni" }, [
      { name: "MangaDex", url: "https://mangadex.org/title/x" },
      { name: "NeloManga", url: "https://www.nelomanga.net/manga/houseki-no-kuni" },
    ])).toEqual([
      {
        name: "Land of the Lustrous",
        url: "https://w1.land-of-the-lustrous.online/",
      },
    ]);
  });

  it("filters existing Houseki sources down to the override source", () => {
    expect(filterSourcesForManga({ slug: "land-of-the-lustrous" }, [
      {
        id: "s1",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/x",
      },
      {
        id: "s2",
        sourceName: "Land of the Lustrous",
        sourceUrl: "https://w1.land-of-the-lustrous.online/",
      },
    ])).toEqual([
      {
        id: "s2",
        sourceName: "Land of the Lustrous",
        sourceUrl: "https://w1.land-of-the-lustrous.online/",
      },
    ]);
  });
});
