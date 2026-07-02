import { describe, expect, it } from "vitest";
import { formatChapterReleaseDate } from "@/lib/chapter-release-date";

describe("formatChapterReleaseDate", () => {
  it("formats a chapter release date for display", () => {
    expect(formatChapterReleaseDate("2026-07-02T12:00:00.000Z", "en-US")).toBe("Jul 2, 2026");
  });

  it("returns null when the provider has no usable release date", () => {
    expect(formatChapterReleaseDate(null, "en-US")).toBeNull();
    expect(formatChapterReleaseDate("not-a-date", "en-US")).toBeNull();
  });
});
