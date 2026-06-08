import { describe, expect, it } from "vitest";
import { countChapterQuality, scoreProbe, summarizeProviderLane, SourceQualityProbe } from "@/lib/source-quality";

describe("source quality scoring", () => {
  const probes: SourceQualityProbe[] = [
    {
      provider: "MangaPill",
      lane: "manga",
      query: "dandadan",
      matchedTitle: "Dandadan",
      exactTitleMatch: true,
      falsePositive: false,
      chapterCount: 240,
      latestChapterNumber: 236,
      readerStatus: "READABLE",
      readerPageCount: 19,
      catalogEstimate: 10_000,
      accessIssue: "none",
    },
    {
      provider: "Official External",
      lane: "manga",
      query: "dandadan",
      matchedTitle: "Dandadan",
      exactTitleMatch: true,
      falsePositive: false,
      chapterCount: 7,
      latestChapterNumber: 236,
      readerStatus: "EXTERNAL_ONLY",
      readerPageCount: 0,
      catalogEstimate: 300,
      accessIssue: "none",
      isOfficial: true,
    },
    {
      provider: "MangaPill",
      lane: "manhwa-manhua-webtoon",
      query: "omniscient reader",
      exactTitleMatch: false,
      falsePositive: false,
      chapterCount: 0,
      readerStatus: "EXTERNAL_ONLY",
      readerPageCount: 0,
      catalogEstimate: 10_000,
      accessIssue: "none",
      supportsLane: false,
    },
    {
      provider: "Webtoon",
      lane: "manhwa-manhua-webtoon",
      query: "omniscient reader",
      matchedTitle: "Omniscient Reader",
      exactTitleMatch: true,
      falsePositive: false,
      chapterCount: 309,
      latestChapterNumber: 309,
      readerStatus: "EXTERNAL_ONLY",
      readerPageCount: 0,
      accessIssue: "none",
      isOfficial: true,
    },
  ];

  it("prioritizes readable sources in reader mode", () => {
    const ranking = summarizeProviderLane(probes, "manga", "reader");

    expect(ranking[0].provider).toBe("MangaPill");
    expect(ranking[0].readableRate).toBe(100);
  });

  it("keeps unsupported lanes below matching lane sources", () => {
    const ranking = summarizeProviderLane(probes, "manhwa-manhua-webtoon", "tracking");

    expect(ranking[0].provider).toBe("Webtoon");
    expect(scoreProbe(probes[2], "tracking")).toBeLessThan(scoreProbe(probes[3], "tracking"));
  });

  it("counts duplicate chapter numbers and integer chapter gaps", () => {
    expect(countChapterQuality([1, 2, 2, 3.5, 5])).toEqual({
      duplicateChapterNumbers: 1,
      missingChapterGaps: 2,
    });
  });
});
