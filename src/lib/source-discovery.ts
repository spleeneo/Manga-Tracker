import { getMangaAliasSlugs, slugifyMangaTitle } from "@/lib/manga-aliases";
import { getRegisteredScrapers } from "@/lib/scrapers/registry";
import type { Scraper, SearchResult } from "@/lib/scrapers/types";

type MangaIdentity = {
  title: string;
  slug?: string | null;
};

type SourceIdentity = {
  sourceName: string;
  sourceUrl: string;
};

function getAcceptedSlugs(manga: MangaIdentity) {
  return new Set([
    slugifyMangaTitle(manga.title),
    ...(manga.slug ? [slugifyMangaTitle(manga.slug)] : []),
    ...getMangaAliasSlugs(manga.title, manga.slug),
  ]);
}

function getUrlSlug(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments.at(-1) ?? "";
  } catch {
    return "";
  }
}

export function isSearchResultForManga(manga: MangaIdentity, result: Pick<SearchResult, "title" | "sourceUrl">) {
  const acceptedSlugs = getAcceptedSlugs(manga);
  return acceptedSlugs.has(slugifyMangaTitle(result.title))
    || acceptedSlugs.has(slugifyMangaTitle(getUrlSlug(result.sourceUrl)));
}

function sourceBelongsToScraper(scraper: Scraper, source: SourceIdentity) {
  return source.sourceName.trim().toLowerCase() === scraper.name.trim().toLowerCase()
    || scraper.canHandle(source.sourceUrl);
}

function canDiscoverChapters(scraper: Scraper) {
  return scraper.capabilities?.search !== false && scraper.capabilities?.chapters !== false;
}

export async function discoverMissingSourcesForManga(manga: MangaIdentity, sources: SourceIdentity[]) {
  const existingUrls = new Set(sources.map((source) => source.sourceUrl.toLowerCase()));
  const discovered: SearchResult[] = [];

  for (const scraper of getRegisteredScrapers()) {
    if (!canDiscoverChapters(scraper) || sources.some((source) => sourceBelongsToScraper(scraper, source))) {
      continue;
    }

    const results = await scraper.search(manga.title).catch(() => []);
    const match = results.find((result) => isSearchResultForManga(manga, result));
    if (!match || existingUrls.has(match.sourceUrl.toLowerCase())) continue;

    existingUrls.add(match.sourceUrl.toLowerCase());
    discovered.push(match);
  }

  return discovered;
}
