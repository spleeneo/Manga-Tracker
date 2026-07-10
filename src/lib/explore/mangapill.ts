import { prisma } from "@/lib/db";
import { normalizeMangaStatus } from "@/lib/manga-status";

const MANGAPILL_BASE_URL = "https://mangapill.com";
const EXPLORE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;
const PAGE_FETCH_LIMIT = 8;

export const MANGAPILL_GENRES = [
  "Action",
  "Adventure",
  "Cars",
  "Comedy",
  "Dementia",
  "Demons",
  "Doujinshi",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Harem",
  "Game",
  "Gender Bender",
  "Horror",
  "Isekai",
  "Josei",
  "Kids",
  "Magic",
  "Martial Arts",
  "Mecha",
  "Military",
  "Music",
  "Mystery",
  "Parody",
  "Police",
  "Psychological",
  "Romance",
  "Samurai",
  "School",
  "Sci-Fi",
  "Seinen",
  "Shoujo",
  "Shoujo Ai",
  "Shounen",
  "Shounen Ai",
  "Slice of Life",
  "Sports",
  "Space",
  "Super Power",
  "Supernatural",
  "Thriller",
  "Tragedy",
  "Vampire",
  "Yaoi",
  "Yuri",
] as const;

export const MANGAPILL_ADULT_GENRES = ["Ecchi", "Doujinshi", "Yaoi", "Yuri"] as const;
const MANGAPILL_ADULT_ALIASES = new Set(["adult-erotic", "adult-porn", "adult-hentai", "adult-erotica"]);
const MANGAPILL_ADULT_ALIAS_GENRES = ["Ecchi"] as const;

export interface MangaPillExploreQuery {
  sort?: string | null;
  genre?: string | null;
  type?: string | null;
  status?: string | null;
  limit?: string | null;
  offset?: string | null;
}

export interface MangaPillExploreManga {
  id: string;
  title: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  status?: string;
  year?: number;
  tags: Array<{ id: string; name: string }>;
  source: { name: "MangaPill"; url: string };
  isTracked: boolean;
}

interface ExploreCacheEntry {
  expiresAt: number;
  value: Omit<MangaPillExploreManga, "isTracked">[];
  hasNextPage: boolean;
}

const exploreCache = new Map<string, ExploreCacheEntry>();

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_match, codePoint: string) => String.fromCodePoint(Number(codePoint)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function toAbsoluteUrl(url: string, base = MANGAPILL_BASE_URL) {
  return new URL(decodeHtml(url), base).toString();
}

export function slugifyMangaPillTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeLimit(value?: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function normalizeOffset(value?: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function normalizeMangaPillStatus(value?: string | null) {
  switch (value) {
    case "completed":
      return "finished";
    case "hiatus":
      return "on hiatus";
    case "cancelled":
      return "discontinued";
    case "ongoing":
      return "publishing";
    default:
      return "";
  }
}

function normalizeMangaPillType(value?: string | null) {
  return ["manga", "novel", "one-shot", "doujinshi", "manhua", "oel"].includes(value ?? "") ? value ?? "" : "";
}

function getGenres(value?: string | null) {
  if (!value) return [];
  if (MANGAPILL_ADULT_ALIASES.has(value)) return [...MANGAPILL_ADULT_ALIAS_GENRES];
  return MANGAPILL_GENRES.includes(value as typeof MANGAPILL_GENRES[number]) ? [value] : [];
}

export function buildMangaPillExploreUrl(query: MangaPillExploreQuery, page = 1) {
  const params = new URLSearchParams();
  const genres = getGenres(query.genre);
  const requestedType = normalizeMangaPillType(query.type);
  const type = requestedType === "doujinshi" && genres.length > 0 ? "" : requestedType;
  const status = normalizeMangaPillStatus(query.status);

  if (genres.length === 0 && !type && !status) {
    if (page > 1) params.set("page", String(page));
    return `${MANGAPILL_BASE_URL}/mangas/new${params.size ? `?${params.toString()}` : ""}`;
  }

  params.set("q", "");
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  for (const genre of genres) {
    params.append("genre", genre);
  }
  if (page > 1) params.set("page", String(page));

  return `${MANGAPILL_BASE_URL}/search?${params.toString()}`;
}

function hasNextPage(html: string) {
  return /href=["'][^"']*page=\d+[^"']*["'][^>]*>\s*Next\s*<\/a>/i.test(html);
}

function getSectionHtml(html: string, heading: string) {
  const headingIndex = html.indexOf(heading);
  if (headingIndex < 0) return "";
  const nextSectionIndex = html.indexOf("<h4", headingIndex + heading.length);
  return html.slice(headingIndex, nextSectionIndex > headingIndex ? nextSectionIndex : undefined);
}

export function parseMangaPillExploreHtml(html: string): Omit<MangaPillExploreManga, "isTracked">[] {
  const trending = getSectionHtml(html, "Trending Mangas") || html;
  const cardLinks = Array.from(trending.matchAll(/<a[^>]+href=["'](\/manga\/\d+\/[^"']+)["'][^>]*class=["'][^"']*relative[^"']*block[^"']*["'][^>]*>/gi));
  const resultsByUrl = new Map<string, Omit<MangaPillExploreManga, "isTracked">>();

  for (let index = 0; index < cardLinks.length; index += 1) {
    const card = cardLinks[index];
    const nextCard = cardLinks[index + 1];
    const cardHtml = trending.slice(card.index ?? 0, nextCard?.index ?? undefined);
    const sourceUrl = toAbsoluteUrl(card[1]);
    const titleMatch = cardHtml.match(/<a[^>]+href=["']\/manga\/\d+\/[^"']+["'][^>]*>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
    const title = titleMatch ? stripTags(titleMatch[1]) : "";
    if (!title) continue;

    const coverMatch = cardHtml.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);
    const chips = Array.from(cardHtml.matchAll(/<div[^>]*class=["'][^"']*text-xs[^"']*rounded[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi))
      .map((match) => stripTags(match[1]))
      .filter(Boolean);
    const normalizedChips = chips.map((chip) => chip.toLowerCase());
    const year = normalizedChips.map((chip) => Number.parseInt(chip, 10)).find((value) => Number.isFinite(value));
    const statusChip = normalizedChips.find((chip) => ["publishing", "completed", "finished", "on hiatus", "discontinued", "not yet published"].includes(chip));
    const tags = chips
      .filter((chip) => !Number.isFinite(Number.parseInt(chip, 10)))
      .filter((chip) => !["manga", "novel", "one-shot", "doujinshi", "manhua", "oel", "publishing", "completed", "finished", "on hiatus", "discontinued", "not yet published"].includes(chip.toLowerCase()))
      .map((name) => ({ id: `mangapill:${slugifyMangaPillTitle(name)}`, name }));

    resultsByUrl.set(sourceUrl, {
      id: `mangapill:${sourceUrl}`,
      title,
      slug: slugifyMangaPillTitle(title),
      coverUrl: coverMatch?.[1] ? toAbsoluteUrl(coverMatch[1], sourceUrl) : undefined,
      status: statusChip ? normalizeMangaStatus(statusChip, "ONGOING") : undefined,
      year,
      tags,
      source: { name: "MangaPill", url: sourceUrl },
    });
  }

  return Array.from(resultsByUrl.values());
}

async function decorateTracked(userId: string, mangas: Omit<MangaPillExploreManga, "isTracked">[]): Promise<MangaPillExploreManga[]> {
  if (mangas.length === 0) return [];
  const sourceUrls = mangas.map((manga) => manga.source.url);
  const trackedSources = await prisma.source.findMany({
    where: {
      sourceUrl: { in: sourceUrls },
      manga: {
        userManga: {
          some: { userId },
        },
      },
    },
    select: { sourceUrl: true },
  });
  const trackedUrls = new Set(trackedSources.map((source) => source.sourceUrl));
  return mangas.map((manga) => ({
    ...manga,
    isTracked: trackedUrls.has(manga.source.url),
  }));
}

export async function getMangaPillExploreManga(userId: string, query: MangaPillExploreQuery) {
  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const targetCount = offset + limit;
  const cacheKey = `${buildMangaPillExploreUrl(query, 1)}|take=${targetCount}`;
  const cached = exploreCache.get(cacheKey);
  let value: Omit<MangaPillExploreManga, "isTracked">[];
  let hasMore = false;

  if (cached && cached.expiresAt > Date.now()) {
    value = cached.value;
    hasMore = cached.hasNextPage;
  } else {
    value = [];
    let page = 1;
    let canFetchNext = true;

    while (canFetchNext && value.length < targetCount && page <= PAGE_FETCH_LIMIT) {
      const res = await fetch(buildMangaPillExploreUrl(query, page), {
        headers: { accept: "text/html" },
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        throw new Error(`MangaPill explore failed (${res.status})`);
      }

      const html = await res.text();
      const pageResults = parseMangaPillExploreHtml(html);
      const seen = new Set(value.map((manga) => manga.source.url));
      value.push(...pageResults.filter((manga) => !seen.has(manga.source.url)));
      canFetchNext = hasNextPage(html) && pageResults.length > 0;
      page += 1;
    }

    hasMore = canFetchNext;

    exploreCache.set(cacheKey, {
      expiresAt: Date.now() + EXPLORE_CACHE_TTL_MS,
      value,
      hasNextPage: hasMore,
    });
  }

  const page = value.slice(offset, offset + limit);
  const nextOffset = offset + limit < value.length || hasMore ? offset + limit : null;

  return {
    results: await decorateTracked(userId, page),
    nextOffset,
  };
}
