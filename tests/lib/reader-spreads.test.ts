import { describe, expect, it } from "vitest";
import { groupReaderPages } from "@/lib/reader-spreads";

describe("manual reader spreads", () => {
  const pages = [0, 1, 2, 3, 4].map((index) => ({ index }));

  it("keeps pages separate by default", () => {
    expect(groupReaderPages(pages, [])).toEqual(pages.map((page) => [page]));
  });

  it("joins only selected adjacent pages without changing source order", () => {
    expect(groupReaderPages(pages, [1, 3])).toEqual([[pages[0]], [pages[1], pages[2]], [pages[3], pages[4]]]);
  });

  it("never duplicates pages for overlapping or final-page selections", () => {
    expect(groupReaderPages(pages, [0, 1, 4])).toEqual([[pages[0], pages[1]], [pages[2]], [pages[3]], [pages[4]]]);
    expect(groupReaderPages([], [0])).toEqual([]);
  });
});
