import { getMangaAliasSlugs, slugifyMangaTitle } from "@/lib/manga-aliases";
import { getRegisteredScrapers } from "@/lib/scrapers/registry";
import type { Scraper, SearchResult } from "@/lib/scrapers/types";

type MangaIdentity = {
  title: string;
  slug?: string | null;
  author?: string | null;
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

function normalizeIdentityValue(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAuthorParts(value?: string | null) {
  const normalized = normalizeIdentityValue(value);
  if (!normalized) return [];

  const parts = normalized
    .split(/\s+(?:and)\s+|[|/;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);

  return parts.length > 0 ? parts : [normalized];
}

function getSortedTokens(value: string) {
  return value.split(/\s+/).filter(Boolean).sort().join(" ");
}

function authorsMatch(left?: string | null, right?: string | null) {
  const leftParts = getAuthorParts(left);
  const rightParts = getAuthorParts(right);

  if (leftParts.length === 0 || rightParts.length === 0) return null;

  return leftParts.some((leftPart) => rightParts.some((rightPart) => (
    leftPart === rightPart
      || leftPart.includes(rightPart)
      || rightPart.includes(leftPart)
      || getSortedTokens(leftPart) === getSortedTokens(rightPart)
  )));
}

function needsStrongIdentityCheck(manga: MangaIdentity) {
  const slug = slugifyMangaTitle(manga.slug ?? manga.title);
  return slug.length <= 6 || !slug.includes("-");
}

export function isSearchResultForManga(manga: MangaIdentity, result: Pick<SearchResult, "title" | "sourceUrl" | "author">) {
  const acceptedSlugs = getAcceptedSlugs(manga);
  const slugMatches = acceptedSlugs.has(slugifyMangaTitle(result.title))
    || acceptedSlugs.has(slugifyMangaTitle(getUrlSlug(result.sourceUrl)));
  if (!slugMatches) return false;

  const authorMatch = authorsMatch(manga.author, result.author);
  if (authorMatch === false) return false;
  if (needsStrongIdentityCheck(manga) && manga.author && !authorMatch) return false;

  return true;
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
