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
  });

  it("rejects near matches and spinoffs", () => {
    expect(isMangaPillTitleMatch(
      { title: "Solo Leveling", slug: "solo-leveling" },
      { title: "Solo Leveling Novel" },
    )).toBe(false);
  });
});
