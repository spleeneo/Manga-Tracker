import { describe, expect, it } from "vitest";
import { getSourceRankMap, getSourceRankScore } from "@/lib/source-ranking";

describe("source ranking", () => {
  it("uses user source position ahead of global provider ranking", () => {
    expect(getSourceRankScore({
      id: "mangadex",
      sourceName: "MangaDex",
      position: 0,
    })).toBeGreaterThan(getSourceRankScore({
      id: "mangapill",
      sourceName: "MangaPill",
      position: 1,
    }));
  });

  it("falls back to global source ranking when no user order exists", () => {
    expect(getSourceRankScore({
      id: "mangapill",
      sourceName: "MangaPill",
    })).toBeGreaterThan(getSourceRankScore({
      id: "mangadex",
      sourceName: "MangaDex",
    }));
  });

  it("builds rank maps keyed by source id", () => {
    expect(getSourceRankMap([
      { id: "s1", sourceName: "MangaDex", position: 1 },
      { id: "s2", sourceName: "MangaPill", position: 0 },
    ])).toEqual({
      s1: 9999,
      s2: 10000,
    });
  });
});
