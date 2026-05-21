import { describe, expect, it } from "vitest";
import { normalizeMangaStatus } from "@/lib/manga-status";

describe("normalizeMangaStatus", () => {
  it("maps common provider status variants to app statuses", () => {
    expect(normalizeMangaStatus("completed")).toBe("COMPLETED");
    expect(normalizeMangaStatus("Finished")).toBe("COMPLETED");
    expect(normalizeMangaStatus("Ended")).toBe("COMPLETED");
    expect(normalizeMangaStatus("Releasing")).toBe("ONGOING");
    expect(normalizeMangaStatus("On Hiatus")).toBe("HIATUS");
    expect(normalizeMangaStatus("canceled")).toBe("CANCELLED");
  });

  it("uses fallback and preserves unknown statuses consistently", () => {
    expect(normalizeMangaStatus(undefined, "ongoing")).toBe("ONGOING");
    expect(normalizeMangaStatus("season break")).toBe("SEASON_BREAK");
  });
});
