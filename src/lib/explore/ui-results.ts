export interface ExploreSource {
  name: string;
  url: string;
}

export interface ExploreTagSummary {
  id: string;
  name: string;
}

export interface BrowseExploreResult {
  id: string;
  title: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  status?: string;
  year?: number;
  tags: ExploreTagSummary[];
  source: ExploreSource;
  isTracked: boolean;
  contentRating?: string;
  classificationSource?: "MANGADEX";
}

export interface AggregatedExploreSearchResult {
  title: string;
  description?: string;
  coverUrl?: string;
  status?: string;
  author?: string;
  sources?: ExploreSource[];
}

export interface ExploreDisplayManga {
  id: string;
  title: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  status?: string;
  year?: number;
  tags: ExploreTagSummary[];
  sources: ExploreSource[];
  isTracked: boolean;
  resultKind: "browse" | "search";
  contentRating?: string;
  classificationSource?: "MANGADEX";
}

export function slugifyExploreTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeBrowseExploreResult(manga: BrowseExploreResult): ExploreDisplayManga {
  return {
    ...manga,
    sources: [manga.source],
    resultKind: "browse",
  };
}

export function normalizeSearchExploreResult(manga: AggregatedExploreSearchResult): ExploreDisplayManga {
  const slug = slugifyExploreTitle(manga.title);
  const sources = manga.sources ?? [];
  const firstSourceUrl = sources[0]?.url ?? slug;

  return {
    id: `search:${firstSourceUrl}`,
    title: manga.title,
    slug,
    description: manga.description,
    coverUrl: manga.coverUrl,
    status: manga.status,
    tags: [],
    sources,
    isTracked: false,
    resultKind: "search",
  };
}

function mergeDisplayManga(existing: ExploreDisplayManga, manga: ExploreDisplayManga): ExploreDisplayManga {
  const sourceUrls = new Set(existing.sources.map((source) => source.url));
  const sources = [
    ...existing.sources,
    ...manga.sources.filter((source) => !sourceUrls.has(source.url)),
  ];
  const tagIds = new Set(existing.tags.map((tag) => tag.id));
  const tags = [
    ...existing.tags,
    ...manga.tags.filter((tag) => !tagIds.has(tag.id)),
  ];

  return {
    ...existing,
    description: existing.description || manga.description,
    coverUrl: existing.coverUrl || manga.coverUrl,
    status: existing.status || manga.status,
    year: existing.year || manga.year,
    contentRating: existing.contentRating || manga.contentRating,
    classificationSource: existing.classificationSource || manga.classificationSource,
    isTracked: existing.isTracked || manga.isTracked,
    sources,
    tags,
  };
}

export function mergeBrowseDisplayResults(...resultGroups: ExploreDisplayManga[][]) {
  const mergedBySlug = new Map<string, ExploreDisplayManga>();
  const maxLength = Math.max(0, ...resultGroups.map((group) => group.length));

  for (let index = 0; index < maxLength; index += 1) {
    for (const group of resultGroups) {
      const manga = group[index];
      if (!manga) continue;

      const existing = mergedBySlug.get(manga.slug);
      mergedBySlug.set(manga.slug, existing ? mergeDisplayManga(existing, manga) : manga);
    }
  }

  return Array.from(mergedBySlug.values());
}
