import { SearchResult } from "@/lib/scrapers/types";
import { isSearchResultForManga } from "@/lib/source-discovery";
import { MangaPillScraper } from "./mangapill";

type MangaIdentity = {
  title: string;
  slug?: string | null;
};

export function isMangaPillTitleMatch(manga: MangaIdentity, result: Pick<SearchResult, "title"> & { sourceUrl?: string }) {
  return isSearchResultForManga(manga, { ...result, sourceUrl: result.sourceUrl ?? "" });
}

export async function discoverMangaPillSource(manga: MangaIdentity) {
  const scraper = new MangaPillScraper();
  const results = await scraper.search(manga.title);
  return results.find((result) => isSearchResultForManga(manga, result)) ?? null;
}
