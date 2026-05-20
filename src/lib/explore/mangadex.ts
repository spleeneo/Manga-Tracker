import { prisma } from "@/lib/db";

const MANGADEX_API = "https://api.mangadex.org";
const MANGADEX_TITLE_URL = "https://mangadex.org/title";
const EXPLORE_CACHE_TTL_MS = 5 * 60 * 1000;
const TAG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;

export type ExploreSort = "trending" | "updated" | "new";

export interface ExploreQuery {
  sort?: string | null;
  q?: string | null;
  includedTags?: string | null;
  publicationDemographic?: string | null;
  status?: string | null;
  limit?: string | null;
  offset?: string | null;
}

export interface ExploreManga {
  id: string;
  title: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  status?: string;
  year?: number;
  tags: Array<{ id: string; name: string }>;
  source: { name: "MangaDex"; url: string };
  isTracked: boolean;
}

export interface ExploreTag {
  id: string;
  name: string;
  group: string;
}

interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: {
    fileName?: string;
  };
}

interface MangaDexMangaItem {
  id: string;
  attributes: {
    title: Record<string, string>;
    description?: Record<string, string>;
    status?: string;
    year?: number;
    tags?: Array<{
      id: string;
      attributes: {
        name: Record<string, string>;
        group: string;
      };
    }>;
  };
  relationships?: MangaDexRelationship[];
}

interface MangaDexMangaResponse {
  data: MangaDexMangaItem[];
  limit?: number;
  offset?: number;
  total?: number;
}

interface MangaDexTagResponse {
  data: Array<{
    id: string;
    attributes: {
      name: Record<string, string>;
      group: string;
    };
  }>;
}

interface ExploreCacheEntry {
  expiresAt: number;
  value: Omit<ExploreManga, "isTracked">[];
  nextOffset: number | null;
}

let tagCache: { expiresAt: number; tags: ExploreTag[] } | null = null;
const exploreCache = new Map<string, ExploreCacheEntry>();

function firstLocalized(values?: Record<string, string>) {
  if (!values) return undefined;
  return values.en || Object.values(values)[0];
}

export function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeSort(sort?: string | null): ExploreSort {
  if (sort === "updated" || sort === "new") return sort;
  return "trending";
}

function normalizeList(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function buildExploreUrl(query: ExploreQuery) {
  const sort = normalizeSort(query.sort);
  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const search = new URLSearchParams();

  search.set("limit", String(limit));
  search.set("offset", String(offset));
  search.append("includes[]", "cover_art");
  search.append("contentRating[]", "safe");
  search.append("contentRating[]", "suggestive");
  search.append("availableTranslatedLanguage[]", "en");

  if (query.q?.trim()) {
    search.set("title", query.q.trim());
  }

  for (const tag of normalizeList(query.includedTags)) {
    search.append("includedTags[]", tag);
  }

  for (const demographic of normalizeList(query.publicationDemographic)) {
    search.append("publicationDemographic[]", demographic);
  }

  for (const status of normalizeList(query.status)) {
    search.append("status[]", status);
  }

  if (sort === "updated") {
    search.set("order[latestUploadedChapter]", "desc");
  } else if (sort === "new") {
    search.set("order[createdAt]", "desc");
  } else {
    search.set("order[followedCount]", "desc");
  }

  return {
    url: `${MANGADEX_API}/manga?${search.toString()}`,
    limit,
    offset,
  };
}

function mapManga(item: MangaDexMangaItem): Omit<ExploreManga, "isTracked"> {
  const title = firstLocalized(item.attributes.title) ?? "Untitled manga";
  const description = firstLocalized(item.attributes.description)?.split("\n")[0];
  const cover = item.relationships?.find((relationship) => relationship.type === "cover_art");
  const fileName = cover?.attributes?.fileName;
  const sourceUrl = `${MANGADEX_TITLE_URL}/${item.id}`;

  return {
    id: item.id,
    title,
    slug: slugifyTitle(title),
    description,
    coverUrl: fileName ? `https://uploads.mangadex.org/covers/${item.id}/${fileName}.256.jpg` : undefined,
    status: item.attributes.status?.toUpperCase(),
    year: item.attributes.year,
    tags: (item.attributes.tags ?? []).slice(0, 4).map((tag) => ({
      id: tag.id,
      name: firstLocalized(tag.attributes.name) ?? "Tag",
    })),
    source: { name: "MangaDex", url: sourceUrl },
  };
}

async function decorateTracked(userId: string, mangas: Omit<ExploreManga, "isTracked">[]): Promise<ExploreManga[]> {
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

export async function getExploreManga(userId: string, query: ExploreQuery) {
  const built = buildExploreUrl(query);
  const cacheKey = built.url;
  const cached = exploreCache.get(cacheKey);
  let value: Omit<ExploreManga, "isTracked">[];
  let nextOffset: number | null;

  if (cached && cached.expiresAt > Date.now()) {
    value = cached.value;
    nextOffset = cached.nextOffset;
  } else {
    const res = await fetch(built.url, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`MangaDex explore failed (${res.status})`);
    }

    const data = (await res.json()) as MangaDexMangaResponse;
    value = (data.data ?? []).map(mapManga);
    const next = built.offset + (data.limit ?? built.limit);
    const total = data.total ?? next;
    nextOffset = next < total ? next : null;

    exploreCache.set(cacheKey, {
      expiresAt: Date.now() + EXPLORE_CACHE_TTL_MS,
      value,
      nextOffset,
    });
  }

  return {
    results: await decorateTracked(userId, value),
    nextOffset,
  };
}

export async function getExploreTags(): Promise<ExploreTag[]> {
  if (tagCache && tagCache.expiresAt > Date.now()) {
    return tagCache.tags;
  }

  const res = await fetch(`${MANGADEX_API}/manga/tag`, {
    headers: { accept: "application/json" },
    next: { revalidate: 86_400 },
  });

  if (!res.ok) {
    throw new Error(`MangaDex tags failed (${res.status})`);
  }

  const data = (await res.json()) as MangaDexTagResponse;
  const tags = (data.data ?? [])
    .map((tag) => ({
      id: tag.id,
      name: firstLocalized(tag.attributes.name) ?? "Tag",
      group: tag.attributes.group,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  tagCache = {
    expiresAt: Date.now() + TAG_CACHE_TTL_MS,
    tags,
  };
  return tags;
}
