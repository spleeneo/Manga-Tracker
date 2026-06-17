import { describe, expect, it } from "vitest";
import { isReaderChapterCompleted } from "@/lib/reader-progress";

describe("isReaderChapterCompleted", () => {
  it("does not complete a chapter before the last page image has loaded", () => {
    expect(isReaderChapterCompleted({
      sectionRect: { top: -2000, bottom: 900 },
      lastPageRect: { top: 500, bottom: 900 },
      lastPageLoaded: false,
      viewportHeight: 800,
      thresholdPx: 420,
    })).toBe(false);
  });

  it("does not complete a chapter before the reader reaches the last page", () => {
    expect(isReaderChapterCompleted({
      sectionRect: { top: -2000, bottom: 1400 },
      lastPageRect: { top: 1000, bottom: 1400 },
      lastPageLoaded: true,
      viewportHeight: 800,
      thresholdPx: 420,
    })).toBe(false);
  });

  it("completes a chapter after the loaded last page is reached near the viewport bottom", () => {
    expect(isReaderChapterCompleted({
      sectionRect: { top: -2600, bottom: 1100 },
      lastPageRect: { top: 500, bottom: 1100 },
      lastPageLoaded: true,
      viewportHeight: 800,
      thresholdPx: 420,
    })).toBe(true);
  });
});
