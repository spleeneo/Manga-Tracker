import { describe, expect, it } from "vitest";
import { getPreferredSourceRank, isDedicatedMangaSourceName } from "@/lib/source-preference";
import { SINGLE_MANGA_SITE_CONFIGS } from "@/lib/scrapers/single-manga-sites";

describe("source preference", () => {
  it("recognizes dedicated manga source names", () => {
    expect(isDedicatedMangaSourceName("Witch Hat Atelier Manga")).toBe(true);
    expect(isDedicatedMangaSourceName("MangaPill")).toBe(false);
  });

  it("recognizes every configured single-title source as dedicated", () => {
    expect(SINGLE_MANGA_SITE_CONFIGS.map((config) => config.sourceName).filter((sourceName) => (
      !isDedicatedMangaSourceName(sourceName)
    ))).toEqual([]);
  });

  it("prefers Witch Hat Atelier Manga for Witch Hat chapter targets", () => {
    expect(getPreferredSourceRank("Witch Hat Atelier Manga", "witch-hat-atelier"))
      .toBeGreaterThan(getPreferredSourceRank("MangaPill", "witch-hat-atelier"));
    expect(getPreferredSourceRank("Witch Hat Atelier Manga", "witch-hat-atelier"))
      .toBeGreaterThan(getPreferredSourceRank("Manganato", "witch-hat-atelier"));
  });

  it("keeps MangaPill ahead of generic single-title fallbacks for other manga", () => {
    expect(getPreferredSourceRank("MangaPill", "houseki-no-kuni"))
      .toBeGreaterThan(getPreferredSourceRank("Land of the Lustrous", "houseki-no-kuni"));
  });
});
