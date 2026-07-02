export interface ExploreSource {
  name: string;
  url: string;
}

export interface ExploreTagSummary {
  id: string;
  name: string;
}

export interface MangaDexExploreResult {
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

export function normalizeBrowseExploreResult(manga: MangaDexExploreResult): ExploreDisplayManga {
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
