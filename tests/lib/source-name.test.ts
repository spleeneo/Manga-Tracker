import { describe, expect, it } from "vitest";
import { inferSourceName } from "@/lib/source-name";

describe("inferSourceName", () => {
  it("maps known provider URLs", () => {
    expect(inferSourceName("https://mangadex.org/title/example")).toBe("MangaDex");
    expect(inferSourceName("https://comikey.com/comics/kengan-omega-manga/10/")).toBe("Comikey");
    expect(inferSourceName("https://www.viz.com/naruto")).toBe("VIZ");
    expect(inferSourceName("https://chapmanganato.to/manga-aa000000")).toBe("Manganato");
    expect(inferSourceName("https://witchhatateliermanga.com/")).toBe("Witch Hat Atelier Manga");
    expect(inferSourceName("https://atsu.moe/read/nh6Ii/Fqt0r")).toBe("Atsumaru");
  });

  it("falls back for unknown provider URLs", () => {
    expect(inferSourceName("https://example.com/manga/example")).toBe("Source");
  });
});
