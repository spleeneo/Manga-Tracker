import { getMangaAliasSlugs, slugifyMangaTitle } from "@/lib/manga-aliases";
import { SearchResult } from "@/lib/scrapers/types";
import { MangaPillScraper } from "./mangapill";

type MangaIdentity = {
  title: string;
  slug?: string | null;
};

function getAcceptedSlugs(manga: MangaIdentity) {
  return new Set([
    slugifyMangaTitle(manga.title),
    ...(manga.slug ? [slugifyMangaTitle(manga.slug)] : []),
    ...getMangaAliasSlugs(manga.title, manga.slug),
  ]);
}

export function isMangaPillTitleMatch(manga: MangaIdentity, result: Pick<SearchResult, "title">) {
  return getAcceptedSlugs(manga).has(slugifyMangaTitle(result.title));
}

export async function discoverMangaPillSource(manga: MangaIdentity) {
  const scraper = new MangaPillScraper();
  const results = await scraper.search(manga.title);
  return results.find((result) => isMangaPillTitleMatch(manga, result)) ?? null;
}
