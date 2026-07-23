import { describe, expect, it } from "vitest";
import { applySourceOverrideToInputSources, filterSourcesForManga, getMangaSourceOverride } from "@/lib/source-overrides";

describe("manga source overrides", () => {
  it("pins NOiSE to the known MangaPill title instead of same-name NeloManga sources", () => {
    expect(getMangaSourceOverride({ slug: "noise" })).toEqual({
      sourceName: "MangaPill",
      sourceUrl: "https://mangapill.com/manga/3174/noise",
      allowedSourceNames: ["mangapill", "mangadex"],
      allowedHostnames: ["mangapill.com", "mangadex.org"],
    });

    expect(applySourceOverrideToInputSources({ title: "NOiSE" }, [
      { name: "NeloManga", url: "https://www.nelomanga.net/manga/noise" },
      { name: "MangaPill", url: "https://mangapill.com/manga/3174/noise" },
    ])).toEqual([
      { name: "MangaPill", url: "https://mangapill.com/manga/3174/noise" },
    ]);

    expect(applySourceOverrideToInputSources({ title: "Noise" }, [
      { name: "NeloManga", url: "https://www.nelomanga.net/manga/noise_44084" },
    ])).toEqual([
      { name: "NeloManga", url: "https://www.nelomanga.net/manga/noise_44084" },
    ]);
  });

  it("hides tracked NOiSE same-name sources from unsupported providers", () => {
    expect(filterSourcesForManga({ slug: "noise" }, [
      {
        id: "s1",
        sourceName: "MangaPill",
        sourceUrl: "https://mangapill.com/manga/3174/noise",
      },
      {
        id: "s2",
        sourceName: "NeloManga",
        sourceUrl: "https://www.nelomanga.net/manga/noise",
      },
      {
        id: "s3",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/9d6393a0-e651-496d-9c68-465b7ee5fad2",
      },
    ])).toEqual([
      {
        id: "s1",
        sourceName: "MangaPill",
        sourceUrl: "https://mangapill.com/manga/3174/noise",
      },
      {
        id: "s3",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/9d6393a0-e651-496d-9c68-465b7ee5fad2",
      },
    ]);
  });

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
