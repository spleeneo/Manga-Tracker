import { describe, expect, it } from "vitest";
import { isMangaPillTitleMatch } from "@/lib/scrapers/mangapill-discovery";

describe("MangaPill discovery", () => {
  it("accepts exact title matches", () => {
    expect(isMangaPillTitleMatch(
      { title: "Dandadan", slug: "dandadan" },
      { title: "Dandadan" },
    )).toBe(true);
  });

  it("accepts configured title aliases", () => {
    expect(isMangaPillTitleMatch(
      { title: "Witch Hat Atelier", slug: "witch-hat-atelier" },
      { title: "Tongari Boushi no Atelier" },
    )).toBe(true);

    expect(isMangaPillTitleMatch(
      { title: "Witch Hat Atelier", slug: "witch-hat-atelier" },
      { title: "Tongari Boushi no Atelier Atelier of Witch Hat" },
    )).toBe(true);
  });

  it("accepts combined MangaPill titles for known aliases", () => {
    expect(isMangaPillTitleMatch(
      { title: "After the Rain", slug: "after-the-rain" },
      { title: "Koi wa Ameagari no You ni After the Rain" },
    )).toBe(true);

    expect(isMangaPillTitleMatch(
      { title: "Koi wa Ameagari no You ni", slug: "koi-wa-ameagari-no-you-ni" },
      { title: "Koi wa Ameagari no You ni After the Rain" },
    )).toBe(true);
  });

  it("rejects near matches and spinoffs", () => {
    expect(isMangaPillTitleMatch(
      { title: "Solo Leveling", slug: "solo-leveling" },
      { title: "Solo Leveling Novel" },
    )).toBe(false);
  });
});
