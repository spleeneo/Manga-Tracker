import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("reader routing invariants", () => {
  it("does not let stale readerStatus metadata bypass retryable in-app sources", () => {
    const chapterList = readSource("src/components/chapter-list.tsx");
    const chapterItem = readSource("src/components/chapter-item.tsx");

    expect(chapterList).not.toContain("readerStatus !== \"READABLE\"");
    expect(chapterItem).not.toContain("readerStatus !== \"READABLE\"");
  });

  it("keeps broad providers visible when dedicated fallback sources exist", () => {
    const chapterList = readSource("src/components/chapter-list.tsx");

    expect(chapterList).not.toContain("isDedicatedMangaSourceName");
    expect(chapterList).toContain("const visibleSources = initialSources");
  });

  it("keeps homepage navigation available from the reader", () => {
    const reader = readSource("src/components/chapter-reader.tsx");

    expect(reader).toContain("href=\"/\"");
    expect(reader).toContain("Return to homepage");
  });
});
