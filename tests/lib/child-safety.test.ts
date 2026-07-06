import { describe, expect, it } from "vitest";
import { childCatalogCoverUrl, childInternalChapterUrl, createChildCatalogSource, legacySourceUrlForTracking, parseChildCatalogSource } from "@/lib/child-safety";

describe("child-safe source references", () => {
  it("round-trips an opaque MangaDex catalog reference without exposing a provider URL", () => {
    const id = "12345678-1234-1234-1234-123456789abc";
    const source = createChildCatalogSource(id);
    expect(source).toEqual({ name: "Mangateo", url: `mangateo:catalog:${id}` });
    expect(parseChildCatalogSource(source.url)).toBe(id);
    expect(parseChildCatalogSource("https://mangadex.org/title/example")).toBeNull();
    expect(legacySourceUrlForTracking(source.url)).toBe("");
    expect(legacySourceUrlForTracking("https://example.com/manga")).toBe("https://example.com/manga");
  });

  it("builds only an internal chapter URL", () => {
    expect(childInternalChapterUrl("naruto", "chapter-1")).toBe("/manga/naruto/chapter/chapter-1");
  });

  it("builds an internal catalog cover URL without exposing the provider", () => {
    const id = "12345678-1234-1234-1234-123456789abc";
    expect(childCatalogCoverUrl(id, `https://uploads.mangadex.org/covers/${id}/cover.jpg.256.jpg`)).toBe(`/api/manga/catalog/${id}/cover?file=cover.jpg.256.jpg`);
    expect(childCatalogCoverUrl(id, "https://example.com/cover.jpg")).toBeUndefined();
  });
});
