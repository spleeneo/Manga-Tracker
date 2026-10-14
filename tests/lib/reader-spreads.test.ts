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

describe("automatic reader spreads", () => {
  const portrait = (index: number) => ({ index, width: 800, height: 1200 });
  it("pairs portraits around full-row wide pages, leaving an odd page alone", () => {
    const pages = [portrait(0), portrait(1), { index: 2, width: 1600, height: 1000 }, portrait(3), portrait(4), portrait(5)];
    expect(groupReaderPages(pages, [], { auto: true })).toEqual([[pages[0], pages[1]], [pages[2]], [pages[3], pages[4]], [pages[5]]]);
  });
  it("waits for dimensions and leaves tall scrolling strips and invalid dimensions alone", () => {
    const pages = [portrait(0), { index: 1 }, { index: 2, width: 800, height: 4000 }, { index: 3, width: 0, height: 1200 }, portrait(4)];
    expect(groupReaderPages(pages, [], { auto: true })).toEqual(pages.map((page) => [page]));
  });
  it("respects unpair corrections and explicit pairing when auto is enabled", () => {
    const pages = [0, 1, 2, 3].map(portrait);
    expect(groupReaderPages(pages, [], { auto: true, singlePages: [0, 1] })).toEqual([[pages[0]], [pages[1]], [pages[2], pages[3]]]);
    expect(groupReaderPages(pages, [1], { auto: true, singlePages: [0, 1] })).toEqual([[pages[0]], [pages[1], pages[2]], [pages[3]]]);
  });
  it("does not let an automatic pair consume the start of a manual pair", () => {
    const pages = [0, 1, 2, 3].map(portrait);
    expect(groupReaderPages(pages, [1], { auto: true })).toEqual([[pages[0]], [pages[1], pages[2]], [pages[3]]]);
  });
});
