"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Compass, ExternalLink, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { CoverImage } from "@/components/cover-image";
import { useDialogFocus } from "@/components/use-dialog-focus";
import { useToast } from "@/components/toast-provider";
import {
  type ExploreDisplayManga,
  buildBrowseCategoryOptions,
  mergeBrowseDisplayResults,
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
const mangaPillCategoryOptions = [
  { value: "adult-erotic", label: "Erotic / adult" },
  { value: "adult-hentai", label: "Hentai" },
  { value: "adult-erotica", label: "Erotica" },
  { value: "adult-porn", label: "Porn" },
  { value: "Ecchi", label: "Ecchi" },
  { value: "Doujinshi", label: "Doujinshi" },
  { value: "Yaoi", label: "Yaoi" },
  { value: "Yuri", label: "Yuri" },
  { value: "Action", label: "Action" },
  { value: "Adventure", label: "Adventure" },
  { value: "Cars", label: "Cars" },
  { value: "Comedy", label: "Comedy" },
  { value: "Dementia", label: "Dementia" },
  { value: "Demons", label: "Demons" },
  { value: "Drama", label: "Drama" },
  { value: "Fantasy", label: "Fantasy" },
  { value: "Game", label: "Game" },
  { value: "Gender Bender", label: "Gender Bender" },
  { value: "Harem", label: "Harem" },
  { value: "Horror", label: "Horror" },
  { value: "Isekai", label: "Isekai" },
  { value: "Josei", label: "Josei" },
  { value: "Kids", label: "Kids" },
  { value: "Magic", label: "Magic" },
  { value: "Martial Arts", label: "Martial Arts" },
  { value: "Mecha", label: "Mecha" },
  { value: "Military", label: "Military" },
  { value: "Music", label: "Music" },
  { value: "Mystery", label: "Mystery" },
  { value: "Parody", label: "Parody" },
  { value: "Police", label: "Police" },
  { value: "Psychological", label: "Psychological" },
  { value: "Romance", label: "Romance" },
  { value: "Samurai", label: "Samurai" },
  { value: "School", label: "School" },
  { value: "Sci-Fi", label: "Sci-Fi" },
  { value: "Seinen", label: "Seinen" },
  { value: "Shoujo", label: "Shoujo" },
  { value: "Shoujo Ai", label: "Shoujo Ai" },
  { value: "Shounen", label: "Shounen" },
  { value: "Shounen Ai", label: "Shounen Ai" },
  { value: "Slice of Life", label: "Slice of Life" },
  { value: "Space", label: "Space" },
  { value: "Sports", label: "Sports" },
  { value: "Super Power", label: "Super Power" },
  { value: "Supernatural", label: "Supernatural" },
  { value: "Thriller", label: "Thriller" },
  { value: "Tragedy", label: "Tragedy" },
  { value: "Vampire", label: "Vampire" },
];

const demographicGenreByValue: Record<string, string> = {
  josei: "Josei",
  seinen: "Seinen",
  shoujo: "Shoujo",
  shounen: "Shounen",
};

function buildQuery(params: {
  sort: ExploreSort;
  q: string;
  tagId: string;
  demographic: string;
  status: string;
  contentRating?: string;
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
  if (params.contentRating) query.set("contentRating", params.contentRating);
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

export function ExplorePage({ initialFilters = {} }: { initialFilters?: Record<string, string> }) {
  const [sort, setSort] = useState<ExploreSort>((["trending", "updated", "new"].includes(initialFilters.sort) ? initialFilters.sort : "trending") as ExploreSort);
  const [query, setQuery] = useState(initialFilters.q ?? "");
  const [submittedQuery, setSubmittedQuery] = useState(initialFilters.q ?? "");
  const [tagId, setTagId] = useState(initialFilters.category ?? "");
  const [demographic, setDemographic] = useState(initialFilters.demographic ?? "");
  const [status, setStatus] = useState(initialFilters.status ?? "");
  const [tags, setTags] = useState<ExploreTag[]>([]);
  const [results, setResults] = useState<ExploreDisplayManga[]>([]);
  const [offsets, setOffsets] = useState<{ pill: number | null; dex: number | null }>({ pill: 0, dex: 0 });
  const [hideTracked, setHideTracked] = useState(initialFilters.hideTracked === "1");
  const [preview, setPreview] = useState<ExploreDisplayManga | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const previewRef = useDialogFocus(Boolean(preview), () => setPreview(null));
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

  const browseCategoryOptions = useMemo(() => {
    return buildBrowseCategoryOptions(mangaPillCategoryOptions, [...tags, ...popularTags]);
  }, [popularTags, tags]);

  const selectedCategory = browseCategoryOptions.find((option) => option.value === tagId);

  const loadExplore = async (append = false, retry = false) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const current = () => controllerRef.current === controller && !controller.signal.aborted;
    if (append) setIsLoadingMore(true); else { setIsLoading(true); setIsLoadingMore(false); }
    setError(null);
    setWarnings([]);
    const read = async (url: string) => {
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load results");
      return data;
    };
    try {
      if (hasSubmittedSearch) {
        if (!isSearchMode) throw new Error("Search at least 3 characters to search all sources.");
        const data = await read(`/api/search/manga?q=${encodeURIComponent(activeSearchQuery)}${retry ? "&retry=1" : ""}`);
        if (!current()) return;
        setResults((data.results ?? []).map(normalizeSearchExploreResult));
        setWarnings(data.failedProviders ?? []);
        setOffsets({ pill: null, dex: null });
        return;
      }
      const shouldFetchPill = (!selectedCategory || Boolean(selectedCategory.mangaPillGenre)) && (!append || offsets.pill !== null);
      const shouldFetchDex = (!selectedCategory || Boolean(selectedCategory.mangaDexTagId) || Boolean(selectedCategory.mangaDexContentRatings?.length)) && (!append || offsets.dex !== null);
      const dexParams = buildQuery({ sort, q: "", tagId: selectedCategory?.mangaDexTagId ?? "", demographic, status,
        contentRating: selectedCategory?.mangaDexContentRatings?.join(","), offset: append ? offsets.dex ?? 0 : 0 });
      const pillParams = new URLSearchParams({ sort, limit: "24", offset: String(append ? offsets.pill ?? 0 : 0),
        ...(selectedCategory?.mangaPillGenre || demographicGenreByValue[demographic] ? { genre: selectedCategory?.mangaPillGenre || demographicGenreByValue[demographic] } : {}), ...(status ? { status } : {}) });
      const responses = await Promise.allSettled([
        shouldFetchPill ? read(`/api/explore/mangapill?${pillParams}`) : Promise.resolve(null),
        shouldFetchDex ? read(`/api/explore?${dexParams}`) : Promise.resolve(null),
      ]);
      if (!current()) return;
      const failures = responses.flatMap((result, index) => result.status === "rejected" ? [index === 0 ? "MangaPill" : "MangaDex"] : []);
      if (responses.every((result) => result.status === "rejected" || !result.value)) throw new Error("Sources could not be loaded. Please retry.");
      const values = responses.map((result) => result.status === "fulfilled" ? result.value : undefined);
      const groups = values.map((data) => (data?.results ?? []).map(normalizeBrowseExploreResult));
      const normalized = mergeBrowseDisplayResults(...groups);
      setResults((previous) => append ? mergeBrowseDisplayResults([...previous, ...normalized]) : normalized);
      setWarnings(failures);
      setOffsets({ pill: values[0] === undefined ? (append ? offsets.pill : 0) : values[0]?.nextOffset ?? null,
        dex: values[1] === undefined ? (append ? offsets.dex : 0) : values[1]?.nextOffset ?? null });
    } catch (loadError) {
      if (!current()) return;
      setError(loadError instanceof Error ? loadError.message : "Could not load results");
    } finally {
      if (current()) { setIsLoading(false); setIsLoadingMore(false); }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/explore/tags", { signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error("Tags unavailable"); const data = await res.json(); setTags(data.tags ?? []); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (submittedQuery) params.set("q", submittedQuery);
    if (sort !== "trending") params.set("sort", sort);
    if (tagId) params.set("category", tagId);
    if (demographic) params.set("demographic", demographic);
    if (status) params.set("status", status);
    if (hideTracked) params.set("hideTracked", "1");
    window.history.replaceState(null, "", `/explore${params.size ? "?" + params : ""}`);
  }, [submittedQuery, sort, tagId, demographic, status, hideTracked]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadExplore(); }, 0);
    return () => { window.clearTimeout(timer); controllerRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, submittedQuery, tagId, demographic, status, selectedCategory?.mangaDexTagId, selectedCategory?.mangaPillGenre]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  const clearSearch = () => {
    setQuery("");
    setSubmittedQuery("");
  };

  const setBrowseCategory = (value: string) => {
    setTagId(value);
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

      setResults((current) => current.map((item) => item.id === manga.id ? { ...item, isTracked: true, librarySlug: data.slug || manga.slug } : item));
      setPreview((current) => current?.id === manga.id ? { ...current, isTracked: true, librarySlug: data.slug || manga.slug } : current);
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
              Find your next read. Browse new stories or search for a title you love.
            </p>
          </div>

          <form onSubmit={submitSearch} className="relative w-full lg:max-w-md">
            <input
              aria-label="Search manga titles"
              className="ui-field h-11 pl-11 pr-24"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search manga titles"
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
                <p className="text-sm font-bold">Search results</p>
                <p className="text-xs font-medium leading-5 text-muted-foreground">
                  Matching titles from available sources.
                </p>
              </div>
              <button type="button" className="ui-button ui-button-secondary shrink-0" onClick={clearSearch}>
                <X className="h-4 w-4" />
                Clear search
              </button>
            </div>
          ) : null}

          {!hasSubmittedSearch ? (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSort(option.value)}
                    className={`ui-tab shrink-0 ${sort === option.value ? "ui-tab-active" : ""}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="relative">
                  <span className="sr-only">Category</span>
                  <select className="ui-field h-10 pl-9" value={tagId} onChange={(event) => setBrowseCategory(event.target.value)}>
                    <option value="">All categories</option>
                    {browseCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </label>

                <label>
                  <span className="sr-only">Demographic</span>
                  <select className="ui-field h-10" value={demographic} onChange={(event) => setDemographic(event.target.value)}>
                    <option value="">All demographics</option>
                    {demographicOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="sr-only">Status</span>
                  <select className="ui-field h-10" value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="">All statuses</option>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : null}

          {!hasSubmittedSearch ? (
            <p className="text-xs font-medium leading-5 text-muted-foreground">
              Browse by genre, audience, and publication status. Availability varies by source.
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideTracked} onChange={(event) => setHideTracked(event.target.checked)} />Hide titles in my library</label>
        {[["Category", selectedCategory?.label], ["Audience", demographic], ["Status", status], ["Search", submittedQuery]].filter(([, value]) => value).map(([label, value]) => <span key={label} className="rounded-full border px-3 py-1 text-xs">{label}: {value}</span>)}
        <button type="button" className="ui-button ui-button-secondary" onClick={() => { clearSearch(); setSort("trending"); setTagId(""); setDemographic(""); setStatus(""); setHideTracked(false); }}>Reset</button>
      </div>
      {warnings.length > 0 && <div role="status" className="surface p-3 text-sm">Some sources are unavailable: {warnings.join(", ")}. Results may be incomplete. <button type="button" className="underline" onClick={() => loadExplore(false, true)}>Retry sources</button></div>}
      {error && results.length > 0 && <div role="alert" className="surface p-3 text-sm">{error} <button type="button" className="underline" onClick={() => loadExplore(false, true)}>Retry</button></div>}
      {!isLoading && hideTracked && results.length > 0 && results.every((manga) => manga.isTracked) && <p className="empty-state">All loaded titles are already in your library. Turn off the filter or load more.</p>}
      {isLoading && results.length > 0 && <p role="status" className="text-sm text-muted-foreground">Loading results…</p>}
      {isLoading && results.length === 0 ? (
        <ExploreSkeleton />
      ) : error && results.length === 0 ? (
        <div className="empty-state">
          <h2 className="text-xl font-semibold">Explore did not load</h2>
          <p className="mt-2 max-w-lg text-muted-foreground">{error}</p>
          <button type="button" className="ui-button ui-button-primary mt-4" onClick={() => loadExplore(false, true)}>
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
            {results.filter((manga) => !hideTracked || !manga.isTracked).map((manga) => {
              const primarySource = manga.sources[0];

              return (
              <article key={manga.id} className="interactive-surface manga-card-surface flex overflow-hidden rounded-lg sm:flex-col">
                {primarySource ? (
                  <a
                    href="#preview"
                    onClick={(event) => { event.preventDefault(); setPreview(manga); }}
                    className="group relative block h-44 w-28 shrink-0 overflow-hidden bg-muted sm:h-72 sm:w-full"
                    aria-label={`Preview ${manga.title}`}
                  >
                    <CoverImage url={manga.coverUrl} className="h-full w-full object-cover" />
                  </a>
                ) : (
                  <div className="relative block h-44 w-28 shrink-0 overflow-hidden bg-muted sm:h-72 sm:w-full">
                  <CoverImage url={manga.coverUrl} className="h-full w-full object-cover" />
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-base font-bold leading-tight">
                      {primarySource ? (
                        <a
                          href="#preview"
                          onClick={(event) => { event.preventDefault(); setPreview(manga); }}
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
                    {primarySource && /^https?:/.test(primarySource.url) ? (
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
                      <span className="text-xs font-bold uppercase text-muted-foreground">{primarySource?.name || "No sources"}</span>
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
                      {manga.isTracked ? "In library" : "Track"}
                    </button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>

          {!hasSubmittedSearch && (offsets.pill !== null || offsets.dex !== null) && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                className="ui-button ui-button-secondary min-w-40"
                onClick={() => loadExplore(true)}
                disabled={isLoadingMore}
              >
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}
      {preview && <div className="dialog-overlay" onClick={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
        <div ref={previewRef} role="dialog" aria-modal="true" aria-labelledby="manga-preview-title" tabIndex={-1} className="dialog-panel max-w-2xl max-h-[85vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4"><h2 id="manga-preview-title" className="text-xl font-bold">{preview.title}</h2><button type="button" aria-label="Close preview" className="ui-icon-button" onClick={() => setPreview(null)}><X className="h-5 w-5" /></button></div>
          <p className="mt-3 text-sm text-muted-foreground">{statusLabel(preview.status)}{preview.year ? ` · ${preview.year}` : ""}</p>
          <p className="mt-4 whitespace-pre-line text-sm leading-6">{preview.description || "No synopsis available."}</p>
          <div className="mt-4 flex flex-wrap gap-2">{preview.tags.map((tag) => <span key={tag.id} className="rounded-full bg-muted px-3 py-1 text-xs">{tag.name}</span>)}</div>
          <div className="mt-5 flex flex-wrap gap-3">{preview.sources.filter((source) => /^https?:/.test(source.url)).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="ui-button ui-button-secondary">Open {source.name}<ExternalLink className="h-4 w-4" /></a>)}</div>
          <div className="mt-6">{preview.isTracked ? <Link href={`/manga/${preview.librarySlug || preview.slug}`} className="ui-button ui-button-primary">Open in library</Link> : <button type="button" className="ui-button ui-button-primary" disabled={Boolean(trackingId) || !preview.sources.length} onClick={() => trackManga(preview)}>{trackingId ? "Tracking…" : "Track manga"}</button>}</div>
        </div>
      </div>}

    </div>
  );
}
