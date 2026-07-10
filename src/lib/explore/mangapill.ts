import { prisma } from "@/lib/db";
import { normalizeMangaStatus } from "@/lib/manga-status";

const MANGAPILL_BASE_URL = "https://mangapill.com";
const EXPLORE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;

export interface MangaPillExploreQuery {
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
    const chips = Array.from(cardHtml.matchAll(/<div[^>]*class=["'][^"']*text-xs[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi))
      .map((match) => stripTags(match[1]).toLowerCase())
      .filter(Boolean);
    const year = chips.map((chip) => Number.parseInt(chip, 10)).find((value) => Number.isFinite(value));
    const statusChip = chips.find((chip) => ["publishing", "completed", "hiatus", "cancelled"].includes(chip));

    resultsByUrl.set(sourceUrl, {
      id: `mangapill:${sourceUrl}`,
      title,
      slug: slugifyMangaPillTitle(title),
      coverUrl: coverMatch?.[1] ? toAbsoluteUrl(coverMatch[1], sourceUrl) : undefined,
      status: statusChip ? normalizeMangaStatus(statusChip, "ONGOING") : undefined,
      year,
      tags: [],
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
  const cacheKey = MANGAPILL_BASE_URL;
  const cached = exploreCache.get(cacheKey);
  let value: Omit<MangaPillExploreManga, "isTracked">[];

  if (cached && cached.expiresAt > Date.now()) {
    value = cached.value;
  } else {
    const res = await fetch(MANGAPILL_BASE_URL, {
      headers: { accept: "text/html" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`MangaPill explore failed (${res.status})`);
    }

    value = parseMangaPillExploreHtml(await res.text());
    exploreCache.set(cacheKey, {
      expiresAt: Date.now() + EXPLORE_CACHE_TTL_MS,
      value,
    });
  }

  const page = value.slice(offset, offset + limit);
  const nextOffset = offset + limit < value.length ? offset + limit : null;

  return {
    results: await decorateTracked(userId, page),
    nextOffset,
  };
}
