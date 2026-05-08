"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChapterItem } from "./chapter-item";
import { CheckUpdatesButton } from "./check-updates-button";
import { RefreshMetadataButton } from "./refresh-metadata-button";
import { ExternalLink } from "lucide-react";

interface Source {
    id: string;
    sourceName: string;
    sourceUrl: string;
}

interface Chapter {
    id: string;
    chapterNumber: number;
    title: string | null;
    url: string;
    releaseDate: Date | null;
    isRead: boolean;
    sourceId: string | null;
}

interface ChapterListProps {
    mangaId: string;
    slug: string;
    initialSources: Source[];
    initialChapters: Chapter[];
}

export function ChapterList({ slug, initialSources, initialChapters }: ChapterListProps) {
    const [selectedSourceId, setSelectedSourceId] = useState<string | "all">(
        initialSources.length > 0 ? initialSources[0].id : "all"
    );
    const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
    const [, setIsRefreshing] = useState(false);
    const autoRefreshAttempts = useRef<Set<string>>(new Set());

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch(`/api/manga/${slug}/check-updates`, {
                method: 'POST'
            });
            if (res.ok) {
                // Refresh data from server
                const dataRes = await fetch(`/api/manga/get?slug=${slug}`);
                const data = await dataRes.json();
                if (data.chapters) {
                    setChapters(data.chapters);
                }
            }
        } catch (e) {
            console.error("Failed to auto-refetch chapters:", e);
        } finally {
            setIsRefreshing(false);
        }
    }, [slug]);

    // Auto-fetch if no chapters for selected source
    useEffect(() => {
        if (selectedSourceId === "all") return;

        const sourceChapters = chapters.filter(c => c.sourceId === selectedSourceId);
        if (sourceChapters.length > 0 || autoRefreshAttempts.current.has(selectedSourceId)) return;

        autoRefreshAttempts.current.add(selectedSourceId);
        const timeoutId = window.setTimeout(() => {
            void handleRefresh();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [chapters, handleRefresh, selectedSourceId]);

    const filteredChapters = selectedSourceId === "all"
        ? chapters
        : chapters.filter(c => c.sourceId === selectedSourceId);

    const selectedSource = initialSources.find(s => s.id === selectedSourceId);

    // Sort chapters by number desc
    const sortedChapters = [...filteredChapters].sort((a, b) => b.chapterNumber - a.chapterNumber);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                    <button
                        onClick={() => setSelectedSourceId("all")}
                        className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${selectedSourceId === "all"
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                    >
                        All Sources
                    </button>
                    {initialSources.map((source) => (
                        <button
                            key={source.id}
                            onClick={() => setSelectedSourceId(source.id)}
                            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${selectedSourceId === source.id
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                        >
                            {source.sourceName}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <CheckUpdatesButton slug={slug} />
                    <RefreshMetadataButton slug={slug} />
                </div>
            </div>

            {selectedSource && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ExternalLink className="h-3 w-3" />
                    <span>Source: </span>
                    <a
                        href={selectedSource.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                    >
                        {selectedSource.sourceUrl}
                    </a>
                </div>
            )}

            {sortedChapters.length === 0 ? (
                <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                    No chapters found for this source.
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sortedChapters.map((chapter) => (
                        <ChapterItem key={chapter.id} chapter={chapter} />
                    ))}
                </div>
            )}
        </div>
    );
}
