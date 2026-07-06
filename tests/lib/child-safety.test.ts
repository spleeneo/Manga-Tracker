import { describe, expect, it } from "vitest";
import { childInternalChapterUrl, createChildCatalogSource, parseChildCatalogSource } from "@/lib/child-safety";

describe("child-safe source references", () => {
  it("round-trips an opaque MangaDex catalog reference without exposing a provider URL", () => {
    const id = "12345678-1234-1234-1234-123456789abc";
    const source = createChildCatalogSource(id);
    expect(source).toEqual({ name: "Mangateo", url: `mangateo:catalog:${id}` });
    expect(parseChildCatalogSource(source.url)).toBe(id);
    expect(parseChildCatalogSource("https://mangadex.org/title/example")).toBeNull();
  });

  it("builds only an internal chapter URL", () => {
    expect(childInternalChapterUrl("naruto", "chapter-1")).toBe("/manga/naruto/chapter/chapter-1");
  });
});
