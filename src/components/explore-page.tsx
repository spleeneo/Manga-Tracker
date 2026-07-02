"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Compass, ExternalLink, Image as ImageIcon, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import {
  type ExploreDisplayManga,
  type MangaDexExploreResult,
  normalizeBrowseExploreResult,
  normalizeSearchExploreResult,
} from "@/lib/explore/ui-results";

type ExploreSort = "trending" | "updated" | "new";

interface ExploreTag {
  id: string;
  name: string;
  group: string;
}

const sortOptions: Array<{ value: ExploreSort; label: string }> = [
  { value: "trending", label: "Trending" },
  { value: "updated", label: "Recently updated" },
  { value: "new", label: "Newly added" },
];

const demographicOptions = ["shounen", "seinen", "shoujo", "josei"];
const statusOptions = ["ongoing", "completed", "hiatus", "cancelled"];

function buildQuery(params: {
  sort: ExploreSort;
  q: string;
  tagId: string;
  demographic: string;
  status: string;
  offset?: number;
}) {
  const query = new URLSearchParams();
  query.set("sort", params.sort);
  query.set("limit", "24");
  query.set("offset", String(params.offset ?? 0));
  if (params.q.trim()) query.set("q", params.q.trim());
  if (params.tagId) query.set("includedTags", params.tagId);
  if (params.demographic) query.set("publicationDemographic", params.demographic);
  if (params.status) query.set("status", params.status);
  return query;
}

function statusLabel(value?: string) {
  return value ? value.replaceAll("_", " ") : "Unknown";
}

function ExploreSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="surface overflow-hidden rounded-lg">
          <div className="h-64 animate-pulse bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-9 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExplorePage() {
  const [sort, setSort] = useState<ExploreSort>("trending");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [tagId, setTagId] = useState("");
  const [demographic, setDemographic] = useState("");
  const [status, setStatus] = useState("");
  const [tags, setTags] = useState<ExploreTag[]>([]);
  const [results, setResults] = useState<ExploreDisplayManga[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast, updateToast } = useToast();
  const activeSearchQuery = submittedQuery.trim();
  const hasSubmittedSearch = activeSearchQuery.length > 0;
  const isSearchMode = activeSearchQuery.length >= 3;

  const popularTags = useMemo(() => {
    const preferred = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance", "Slice of Life", "Sports", "Mystery", "Sci-Fi"];
    const byName = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag]));
    const chosen = preferred.map((name) => byName.get(name.toLowerCase())).filter(Boolean) as ExploreTag[];
    return chosen.length > 0 ? chosen : tags.slice(0, 10);
  }, [tags]);

  const loadExplore = async (offset = 0, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      if (hasSubmittedSearch) {
        setNextOffset(null);
        if (!isSearchMode) {
          setResults([]);
          setError("Search at least 3 characters to search all sources.");
          return;
        }

        const res = await fetch(`/api/manga/search?q=${encodeURIComponent(activeSearchQuery)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to search sources");
        setResults((data.results ?? []).map(normalizeSearchExploreResult));
        return;
      }

      const params = buildQuery({
        sort,
        q: "",
        tagId,
        demographic,
        status,
        offset,
      });
      const res = await fetch(`/api/explore?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load explore results");
      const normalized = (data.results ?? []).map((manga: MangaDexExploreResult) => normalizeBrowseExploreResult(manga));
      setResults((current) => append ? [...current, ...normalized] : normalized);
      setNextOffset(data.nextOffset ?? null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load explore results";
      setError(message);
      if (!append) setResults([]);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetch("/api/explore/tags")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load tags");
        setTags(data.tags ?? []);
      })
      .catch((tagError) => {
        console.error(tagError);
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadExplore(0, false);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, submittedQuery, tagId, demographic, status]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  const clearSearch = () => {
    setQuery("");
    setSubmittedQuery("");
  };

  const trackManga = async (manga: ExploreDisplayManga) => {
    if (manga.isTracked || trackingId) return;
    setTrackingId(manga.id);
    const toastId = showToast({
      type: "loading",
      title: `Tracking ${manga.title}`,
      description: "Adding it to your library now.",
    });

    try {
      const res = await fetch("/api/manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manga.title,
          slug: manga.slug,
          coverUrl: manga.coverUrl,
          status: manga.status || "ONGOING",
          description: manga.description,
          sources: manga.sources,
          contentRating: manga.contentRating,
          classificationSource: manga.classificationSource,
          tags: manga.tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to track manga");

      setResults((current) => current.map((item) => item.id === manga.id ? { ...item, isTracked: true } : item));
      window.dispatchEvent(new Event("mangateo:library-refresh"));
      updateToast(toastId, {
        type: "success",
        title: `${manga.title} is tracked`,
        description: "Chapters are syncing in the background.",
      });
    } catch (trackError) {
      updateToast(toastId, {
        type: "error",
        title: `Could not track ${manga.title}`,
        description: trackError instanceof Error ? trackError.message : "Please try again.",
        durationMs: 7000,
      });
    } finally {
      setTrackingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-bold uppercase">
              <Compass className="h-4 w-4" />
              Explore
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Discover manga</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
              Browse popular MangaDex titles, or search across every registered source before deciding what to track.
            </p>
          </div>

          <form onSubmit={submitSearch} className="relative w-full lg:max-w-md">
            <input
              className="ui-field h-11 pl-11 pr-24"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles"
            />
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <button type="submit" className="ui-button ui-button-primary absolute right-1 top-1 h-9 min-h-0 px-3">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="surface sticky top-16 z-20 rounded-lg p-3 sm:static sm:p-4">
        <div className="flex flex-col gap-3">
          {hasSubmittedSearch ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold">Searching all registered sources</p>
                <p className="text-xs font-medium leading-5 text-muted-foreground">
                  Sort, category, demographic, and status filters apply to MangaDex browsing only.
                </p>
              </div>
              <button type="button" className="ui-button ui-button-secondary shrink-0" onClick={clearSearch}>
                <X className="h-4 w-4" />
                Clear search
              </button>
            </div>
          ) : null}

          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar" aria-disabled={hasSubmittedSearch}>
            {sortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSort(option.value)}
                disabled={hasSubmittedSearch}
                className={`ui-tab shrink-0 ${sort === option.value ? "ui-tab-active" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="relative">
              <span className="sr-only">Category</span>
              <select className="ui-field h-10 pl-9 disabled:opacity-50" value={tagId} onChange={(event) => setTagId(event.target.value)} disabled={hasSubmittedSearch}>
                <option value="">All categories</option>
                {popularTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </label>

            <label>
              <span className="sr-only">Demographic</span>
              <select className="ui-field h-10 disabled:opacity-50" value={demographic} onChange={(event) => setDemographic(event.target.value)} disabled={hasSubmittedSearch}>
                <option value="">All demographics</option>
                {demographicOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Status</span>
              <select className="ui-field h-10 disabled:opacity-50" value={status} onChange={(event) => setStatus(event.target.value)} disabled={hasSubmittedSearch}>
                <option value="">All statuses</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {isLoading ? (
        <ExploreSkeleton />
      ) : error ? (
        <div className="empty-state">
          <h2 className="text-xl font-semibold">Explore did not load</h2>
          <p className="mt-2 max-w-lg text-muted-foreground">{error}</p>
          <button type="button" className="ui-button ui-button-primary mt-4" onClick={() => loadExplore(0, false)}>
            Try again
          </button>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <h2 className="text-xl font-semibold">No manga found</h2>
          <p className="mt-2 max-w-lg text-muted-foreground">Try another search term or loosen the filters.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((manga) => {
              const primarySource = manga.sources[0];

              return (
              <article key={manga.id} className="interactive-surface manga-card-surface flex overflow-hidden rounded-lg sm:flex-col">
                {primarySource ? (
                  <a
                    href={primarySource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block h-44 w-28 shrink-0 overflow-hidden bg-muted sm:h-72 sm:w-full"
                    aria-label={`Open ${manga.title} on ${primarySource.name}`}
                  >
                    {manga.coverUrl ? (
                      <img
                        src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-10 w-10 opacity-25" />
                      </div>
                    )}
                  </a>
                ) : (
                  <div className="relative block h-44 w-28 shrink-0 overflow-hidden bg-muted sm:h-72 sm:w-full">
                  {manga.coverUrl ? (
                    <img
                      src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-10 w-10 opacity-25" />
                    </div>
                  )}
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-base font-bold leading-tight">
                      {primarySource ? (
                        <a
                          href={primarySource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {manga.title}
                        </a>
                      ) : (
                        manga.title
                      )}
                    </h2>
                    <span className="shrink-0 rounded-full border bg-card px-2 py-1 text-[10px] font-bold uppercase">
                      {statusLabel(manga.status)}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-3 text-xs font-medium leading-5 text-muted-foreground">
                    {manga.description || "No summary available from this source."}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Manga tags and sources">
                    {manga.tags.slice(0, 3).map((tag) => (
                      <span key={tag.id} className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                        {tag.name}
                      </span>
                    ))}
                    {manga.sources.map((source) => (
                      <span key={source.url} className="max-w-full truncate rounded-full border bg-card px-2 py-1 text-[10px] font-bold uppercase text-foreground">
                        {source.name}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    {primarySource ? (
                      <a
                        href={primarySource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-w-0 items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span className="truncate">{manga.sources.length > 1 ? `${manga.sources.length} sources` : primarySource.name}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs font-bold uppercase text-muted-foreground">No sources</span>
                    )}
                    <button
                      type="button"
                      onClick={() => trackManga(manga)}
                      disabled={manga.isTracked || Boolean(trackingId) || manga.sources.length === 0}
                      className={manga.isTracked ? "ui-button ui-button-secondary h-9" : "ui-button ui-button-primary h-9"}
                    >
                      {trackingId === manga.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : manga.isTracked ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                      {manga.isTracked ? "Tracked" : "Track"}
                    </button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>

          {nextOffset !== null && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                className="ui-button ui-button-secondary min-w-40"
                onClick={() => loadExplore(nextOffset, true)}
                disabled={isLoadingMore}
              >
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
