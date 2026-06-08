import { describe, expect, it } from "vitest";
import { applySourceOverrideToInputSources, filterSourcesForManga, getMangaSourceOverride } from "@/lib/source-overrides";

describe("manga source overrides", () => {
  it("does not force Houseki no Kuni to the single-title source", () => {
    expect(getMangaSourceOverride({ slug: "houseki-no-kuni" })).toBeNull();

    expect(applySourceOverrideToInputSources({ title: "Houseki no Kuni" }, [
      { name: "MangaDex", url: "https://mangadex.org/title/x" },
      { name: "NeloManga", url: "https://www.nelomanga.net/manga/houseki-no-kuni" },
    ])).toEqual([
      { name: "MangaDex", url: "https://mangadex.org/title/x" },
      { name: "NeloManga", url: "https://www.nelomanga.net/manga/houseki-no-kuni" },
    ]);
  });

  it("keeps broad providers visible alongside Houseki single-title fallbacks", () => {
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
        id: "s1",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/x",
      },
      {
        id: "s2",
        sourceName: "Land of the Lustrous",
        sourceUrl: "https://w1.land-of-the-lustrous.online/",
      },
    ]);
  });

  it("keeps dedicated manga sources as fallback options instead of hiding broad providers", () => {
    expect(filterSourcesForManga({ slug: "blue-lock" }, [
      {
        id: "s1",
        sourceName: "NeloManga",
        sourceUrl: "https://www.nelomanga.net/manga/blue-lock",
      },
      {
        id: "s2",
        sourceName: "Blue Lock Manga",
        sourceUrl: "https://w45.blue-lock-manga.com/",
      },
      {
        id: "s3",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/x",
      },
    ])).toEqual([
      {
        id: "s1",
        sourceName: "NeloManga",
        sourceUrl: "https://www.nelomanga.net/manga/blue-lock",
      },
      {
        id: "s2",
        sourceName: "Blue Lock Manga",
        sourceUrl: "https://w45.blue-lock-manga.com/",
      },
      {
        id: "s3",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/x",
      },
    ]);

    expect(applySourceOverrideToInputSources({ title: "Sakamoto Days" }, [
      { name: "MangaDex", url: "https://mangadex.org/title/x" },
      { name: "Sakamoto Days Manga", url: "https://w45.sakamoto-days-manga.com/" },
    ])).toEqual([
      { name: "MangaDex", url: "https://mangadex.org/title/x" },
      { name: "Sakamoto Days Manga", url: "https://w45.sakamoto-days-manga.com/" },
    ]);
  });
});
