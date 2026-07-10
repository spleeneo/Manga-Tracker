import { describe, expect, it } from "vitest";
import { buildMangaPillExploreUrl, parseMangaPillExploreHtml } from "@/lib/explore/mangapill";

describe("MangaPill explore", () => {
  it("extracts trending MangaPill cards without MangaDex tags", () => {
    const results = parseMangaPillExploreHtml(`
      <h4>Featured Chapters</h4>
      <a href="/manga/999/featured"><div>Featured Only</div></a>
      <h4>Trending Mangas</h4>
      <div>
        <a href="/manga/1/berserk" class="relative block">
          <figure><img data-src="https://cdn.readdetectiveconan.com/file/mangapill/i/1.jpeg" alt="Berserk" /></figure>
        </a>
        <div class="flex flex-col justify-end">
          <a href="/manga/1/berserk" class="mb-2">
            <div class="mt-3 font-black leading-tight line-clamp-2">Berserk</div>
          </a>
          <div class="flex flex-wrap gap-1 mt-1">
            <div class="text-xs leading-5 font-semibold bg-card rounded p-1">manga</div>
            <div class="text-xs leading-5 font-semibold bg-card rounded p-1">1989</div>
            <div class="text-xs leading-5 font-semibold bg-card rounded p-1">publishing</div>
          </div>
          <div class="flex flex-wrap gap-1 mt-1">
            <div class="text-xs leading-5 bg-card rounded px-1.5">Action</div>
            <div class="text-xs leading-5 bg-card rounded px-1.5">Horror</div>
          </div>
        </div>
      </div>
      <div>
        <a href="/manga/2/one-piece" class="relative block">
          <figure><img src="https://cdn.readdetectiveconan.com/file/mangapill/i/2.webp" alt="One Piece" /></figure>
        </a>
        <div class="flex flex-col justify-end">
          <a href="/manga/2/one-piece" class="mb-2">
            <div class="mt-3 font-black leading-tight line-clamp-2">One Piece</div>
          </a>
          <div class="flex flex-wrap gap-1 mt-1">
            <div class="text-xs leading-5 font-semibold bg-card rounded p-1">manga</div>
            <div class="text-xs leading-5 font-semibold bg-card rounded p-1">1997</div>
            <div class="text-xs leading-5 font-semibold bg-card rounded p-1">completed</div>
          </div>
        </div>
      </div>
    `);

    expect(results).toEqual([
      {
        id: "mangapill:https://mangapill.com/manga/1/berserk",
        title: "Berserk",
        slug: "berserk",
        coverUrl: "https://cdn.readdetectiveconan.com/file/mangapill/i/1.jpeg",
        status: "ONGOING",
        year: 1989,
        tags: [
          { id: "mangapill:action", name: "Action" },
          { id: "mangapill:horror", name: "Horror" },
        ],
        source: { name: "MangaPill", url: "https://mangapill.com/manga/1/berserk" },
      },
      {
        id: "mangapill:https://mangapill.com/manga/2/one-piece",
        title: "One Piece",
        slug: "one-piece",
        coverUrl: "https://cdn.readdetectiveconan.com/file/mangapill/i/2.webp",
        status: "COMPLETED",
        year: 1997,
        tags: [],
        source: { name: "MangaPill", url: "https://mangapill.com/manga/2/one-piece" },
      },
    ]);
  });

  it("builds MangaPill filter URLs including mature category aliases", () => {
    expect(buildMangaPillExploreUrl({
      sort: "trending",
      genre: "adult-erotic",
      type: "doujinshi",
      status: "completed",
    }, 2)).toBe("https://mangapill.com/search?q=&status=finished&genre=Ecchi&page=2");

    expect(buildMangaPillExploreUrl({ sort: "trending" }, 1)).toBe("https://mangapill.com/mangas/new");
    expect(buildMangaPillExploreUrl({ sort: "new" }, 3)).toBe("https://mangapill.com/mangas/new?page=3");
    expect(buildMangaPillExploreUrl({ sort: "new", genre: "Ecchi" }, 1)).toBe("https://mangapill.com/search?q=&genre=Ecchi");
    expect(buildMangaPillExploreUrl({ genre: "adult-hentai" }, 1)).toBe("https://mangapill.com/search?q=&genre=Ecchi");
    expect(buildMangaPillExploreUrl({ genre: "Doujinshi", type: "doujinshi" }, 1)).toBe("https://mangapill.com/search?q=&genre=Doujinshi");
  });
});
