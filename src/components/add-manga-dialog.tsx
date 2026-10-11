"use client";

import { useState, useEffect } from "react";
import { Plus, X, Loader2, Sparkles, Search } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { legacySourceUrlForTracking } from "@/lib/child-safety";
import { useRouter } from "next/navigation";
import { useDialogFocus } from "@/components/use-dialog-focus";
import { CoverImage } from "@/components/cover-image";

interface SearchSource {
    name: string;
    url: string;
}

interface SearchResult {
    isTracked?: boolean;
    librarySlug?: string;
    title: string;
    coverUrl?: string;
    status?: string;
    description?: string;
    sources?: SearchSource[];
    contentRating?: string;
    classificationSource?: string;
    tags?: Array<{ id: string; name: string; group?: string }>;
}

export function AddMangaDialog() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [failedProviders, setFailedProviders] = useState<string[]>([]);
    const [retrySearch, setRetrySearch] = useState(0);
    const [trackingKey, setTrackingKey] = useState<string | null>(null);
    const { showToast, updateToast } = useToast();
    const visibleSearchResults = searchQuery.trim().length >= 3 ? searchResults : [];
    const dialogRef = useDialogFocus(isOpen, () => setIsOpen(false));

    // Simple debounce for search
    useEffect(() => {
        const query = searchQuery.trim();
        if (!isOpen || query.length < 3) {
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setIsSearching(true);
            setSearchError(null);
            setFailedProviders([]);
            try {
                const res = await fetch(`/api/manga/search?q=${encodeURIComponent(query)}${retrySearch ? "&retry=1" : ""}`, {
                    signal: controller.signal,
                });
                const data = await res.json();
                if (controller.signal.aborted) return;
                if (!res.ok) {
                    throw new Error(data.error || "Search failed");
                }
                setSearchResults((data.results || []) as SearchResult[]);
                setFailedProviders(data.failedProviders ?? []);
            } catch (e) {
                if (controller.signal.aborted) {
                    return;
                }
                console.error(e);
                setSearchResults([]);
                setSearchError(e instanceof Error ? e.message : "Search failed");
            } finally {
                if (!controller.signal.aborted) {
                    setIsSearching(false);
                }
            }
        }, 500);

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [searchQuery, retrySearch, isOpen]);

    const getMangaFormData = (manga: SearchResult, initialSourceUrl?: string) => {
      const sourceUrl = initialSourceUrl || (manga.sources && manga.sources[0]?.url) || "";
      return ({
        title: manga.title,
        slug: manga.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        coverUrl: manga.coverUrl || "",
        status: manga.status || "ONGOING",
        description: manga.description || "",
        sourceUrl: legacySourceUrlForTracking(sourceUrl),
        sources: manga.sources || [],
        contentRating: manga.contentRating,
        classificationSource: manga.classificationSource,
        tags: manga.tags || [],
      });
    };

    const handleSearchQueryChange = (value: string) => {
        setSearchQuery(value);
        setFailedProviders([]);
        if (value.trim().length < 3) {
            setIsSearching(false);
            setSearchError(null);
            setSearchResults([]);
        }
    };

    const trackSearchResult = async (manga: SearchResult, initialSourceUrl?: string) => {
        const key = `${manga.title}:${initialSourceUrl || "all"}`;
        const payload = getMangaFormData(manga, initialSourceUrl);
        const toastId = showToast({
            type: "loading",
            title: `Tracking ${manga.title}`,
            description: "Adding it to your library now.",
        });

        setTrackingKey(key);
        setLoading(true);
        setIsOpen(false);
        resetForm();

        try {
            const res = await fetch("/api/manga", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to track manga");
            }

            updateToast(toastId, {
                type: "success",
                title: `${manga.title} is tracked`,
                description: "Chapters are syncing in the background.",
            });
            window.dispatchEvent(new Event("mangateo:library-refresh"));
        } catch (error) {
            console.error(error);
            updateToast(toastId, {
                type: "error",
                title: `Could not track ${manga.title}`,
                description: error instanceof Error ? error.message : "Failed to track manga",
                durationMs: 7000,
            });
        } finally {
            setLoading(false);
            setTrackingKey(null);
        }
    };

    const resetForm = () => {
        setSearchQuery("");
        setSearchResults([]);
        setSearchError(null);
        setFailedProviders([]);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="ui-button ui-button-primary h-10 w-10 px-0 sm:w-auto sm:px-3.5"
                aria-label="Track new manga"
                title="Track new manga"
            >
                <Plus className="h-4 w-4" />
                <span className="hidden xl:inline">Track New Manga</span>
            </button>
        {isOpen && <div className="dialog-overlay sm:p-6">
            <div
                className="absolute inset-0"
                onClick={() => setIsOpen(false)}
            />

            <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-manga-title" tabIndex={-1} className="dialog-panel max-w-[min(92vw,760px)]">
                {/* Header */}
                <div className="flex items-center justify-between border-b bg-card px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-md bg-primary/10 p-2 text-primary">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 id="add-manga-title" className="text-lg font-bold tracking-tight">Add New Manga</h2>
                            <p className="text-xs font-medium text-muted-foreground">Search to track reading progress</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="ui-icon-button"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[72vh] overflow-y-auto p-6 custom-scrollbar sm:p-8">
                    <div className="space-y-6">
                        <div className="relative">
                            <input
                                aria-label="Search manga"
                                placeholder="Search (e.g. Naruto, One Piece...)"
                                className="ui-field h-12 pl-12 pr-12"
                                value={searchQuery}
                                onChange={(e) => handleSearchQueryChange(e.target.value)}
                            />
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            {isSearching && <Loader2 className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-primary" />}
                        </div>

                        {failedProviders.length > 0 && <p role="status" className="text-sm text-muted-foreground">Some sources could not be searched: {failedProviders.join(", ")}. <button type="button" className="underline" onClick={() => setRetrySearch((value) => value + 1)}>Retry</button></p>}
                        <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-2 custom-scrollbar">
                            {searchError && searchQuery.trim().length >= 3 && !isSearching ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                    <Search className="mb-2 h-8 w-8 opacity-20" />
                                    <p className="text-sm">Search failed</p>
                                    <p className="mt-1 max-w-sm text-xs">{searchError}</p><button className="mt-2 underline" onClick={() => setRetrySearch((value) => value + 1)}>Retry</button>
                                </div>
                            ) : visibleSearchResults.length > 0 ? (
                                visibleSearchResults.map((manga, idx) => (
                                    <div
                                        key={manga.sources?.[0]?.url || idx}
                                        role="button"
                                        tabIndex={loading ? -1 : 0}
                                        onClick={() => {
                                            if (!loading) { if (manga.isTracked && manga.librarySlug) { setIsOpen(false); router.push(`/manga/${manga.librarySlug}`); } else void trackSearchResult(manga); }
                                        }}
                                        onKeyDown={(event) => {
                                            if (loading) return;
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                if (manga.isTracked && manga.librarySlug) { setIsOpen(false); router.push(`/manga/${manga.librarySlug}`); } else void trackSearchResult(manga);
                                            }
                                        }}
                                        className="interactive-surface group grid min-h-32 min-w-0 cursor-pointer grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-4"
                                        aria-label={`${manga.isTracked ? "Open in library" : "Track"} ${manga.title}`}
                                    >
                                        <div className="h-28 w-[72px] shrink-0 overflow-hidden rounded-md border bg-muted sm:w-20">
                                            <CoverImage url={manga.coverUrl} className="h-full w-full object-cover" />
                                        </div>
                                        <div className="flex min-w-0 flex-col overflow-hidden py-1">
                                            <h3 className="flex items-center gap-2 truncate pr-2 text-base font-bold leading-tight transition-colors group-hover:text-primary">
                                                {trackingKey === `${manga.title}:all` && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                                                <span className="truncate">{manga.title}</span>{manga.isTracked && <span className="text-xs text-muted-foreground">In library</span>}
                                            </h3>
                                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{manga.description || "No description available."}</p>
                                            <div className="mt-auto flex min-w-0 items-end justify-between gap-3 pt-3">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                    {manga.sources && Array.isArray(manga.sources) && manga.sources.length > 0 ? (
                                                        manga.sources.map((source: SearchSource, sourceIdx: number) => (
                                                            <span
                                                                key={source.url || sourceIdx}
                                                                className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[10px] font-bold uppercase text-secondary-foreground"
                                                            >
                                                                <span className="truncate">{source.name}</span>
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs font-bold text-red-500">No sources</span>
                                                    )}
                                                </div>
                                                {manga.status ? (
                                                    <span className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{manga.status}</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : searchQuery.length >= 3 && !isSearching ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                    <Search className="mb-2 h-8 w-8 opacity-20" />
                                    <p className="text-sm">No results found</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                    <Sparkles className="mb-2 h-8 w-8 opacity-20" />
                                    <p className="text-sm">Type to search</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>}
        </>
    );
}
