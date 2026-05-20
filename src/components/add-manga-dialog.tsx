"use client";

import { useState, useEffect } from "react";
import { Plus, X, Loader2, Sparkles, Image as ImageIcon, Search } from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface SearchSource {
    name: string;
    url: string;
}

interface SearchResult {
    title: string;
    coverUrl?: string;
    status?: string;
    description?: string;
    sources?: SearchSource[];
}

export function AddMangaDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [trackingKey, setTrackingKey] = useState<string | null>(null);
    const { showToast, updateToast } = useToast();
    const visibleSearchResults = searchQuery.trim().length >= 3 ? searchResults : [];

    // Simple debounce for search
    useEffect(() => {
        const query = searchQuery.trim();
        if (query.length < 3) {
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`/api/manga/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                console.log("Search API response:", data);
                console.log("Search results:", data.results);
                setSearchResults((data.results || []) as SearchResult[]);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const getMangaFormData = (manga: SearchResult, initialSourceUrl?: string) => ({
        title: manga.title,
        slug: manga.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        coverUrl: manga.coverUrl || "",
        status: manga.status || "ONGOING",
        description: manga.description || "",
        sourceUrl: initialSourceUrl || (manga.sources && manga.sources[0]?.url) || "",
        sources: manga.sources || [],
    });

    const handleSearchQueryChange = (value: string) => {
        setSearchQuery(value);
        if (value.trim().length < 3) {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [isOpen]);

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
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="ui-button ui-button-primary h-10 w-10 px-0 sm:w-auto sm:px-3.5"
                aria-label="Track new manga"
                title="Track new manga"
            >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Track New Manga</span>
            </button>
        );
    }

    return (
        <div className="dialog-overlay sm:p-6">
            <div
                className="absolute inset-0"
                onClick={() => setIsOpen(false)}
            />

            <div className="dialog-panel max-w-[min(92vw,760px)]">
                {/* Header */}
                <div className="flex items-center justify-between border-b bg-card px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-md bg-primary/10 p-2 text-primary">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">Add New Manga</h2>
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
                                autoFocus
                                placeholder="Search (e.g. Naruto, One Piece...)"
                                className="ui-field h-12 pl-12 pr-12"
                                value={searchQuery}
                                onChange={(e) => handleSearchQueryChange(e.target.value)}
                            />
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            {isSearching && <Loader2 className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-primary" />}
                        </div>

                        <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-2 custom-scrollbar">
                            {visibleSearchResults.length > 0 ? (
                                visibleSearchResults.map((manga, idx) => (
                                    <div
                                        key={manga.title || idx}
                                        role="button"
                                        tabIndex={loading ? -1 : 0}
                                        onClick={() => {
                                            if (!loading) void trackSearchResult(manga);
                                        }}
                                        onKeyDown={(event) => {
                                            if (loading) return;
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                void trackSearchResult(manga);
                                            }
                                        }}
                                        className="interactive-surface group grid min-w-0 cursor-pointer grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[80px_minmax(0,1fr)] sm:gap-4"
                                        aria-label={`Track ${manga.title}`}
                                    >
                                        <div className="h-28 w-[72px] shrink-0 overflow-hidden rounded-md border bg-muted sm:w-20">
                                            {manga.coverUrl ? (
                                                <img src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-8 w-8 opacity-20" /></div>
                                            )}
                                        </div>
                                        <div className="min-w-0 overflow-hidden py-1">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void trackSearchResult(manga);
                                                }}
                                                disabled={loading}
                                                className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <h3 className="flex items-center gap-2 truncate pr-2 text-base font-bold leading-tight transition-colors group-hover:text-primary">
                                                    {trackingKey === `${manga.title}:all` && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                                                    <span className="truncate">{manga.title}</span>
                                                </h3>
                                            </button>
                                            <p className="mb-2 mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{manga.description || "No description available."}</p>
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                {manga.sources && Array.isArray(manga.sources) && manga.sources.length > 0 ? (
                                                    manga.sources.map((source: SearchSource, sourceIdx: number) => (
                                                        <button
                                                            type="button"
                                                            key={source.url || sourceIdx}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                void trackSearchResult(manga, source.url);
                                                            }}
                                                            disabled={loading}
                                                            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-transparent bg-secondary px-2 py-1 text-[10px] font-bold uppercase text-secondary-foreground transition-all hover:border-primary/40 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                        >
                                                            {trackingKey === `${manga.title}:${source.url}` && <Loader2 className="h-3 w-3 animate-spin" />}
                                                            <span className="truncate">{source.name}</span>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-red-500">No sources</span>
                                                )}
                                                {manga.status ? (
                                                    <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground sm:ml-auto">{manga.status}</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : searchQuery.length >= 3 && !isSearching ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                    <Search className="h-8 w-8 opacity-20 mb-2" />
                                    <p className="text-sm">No results found</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                    <Sparkles className="h-8 w-8 opacity-20 mb-2" />
                                    <p className="text-sm">Type to search</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
