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
    sourceName?: string;
    alternativeCount?: number;
}

interface ChapterListProps {
    mangaId: string;
    slug: string;
    initialSources: Source[];
    initialChapters: Chapter[];
}

export function ChapterList({ slug, initialSources, initialChapters }: ChapterListProps) {
    const [selectedSourceId, setSelectedSourceId] = useState<string | "all">(
        "all"
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

    const sourceById = new Map(initialSources.map((source) => [source.id, source]));

    const getSourceRank = (sourceName?: string) => {
        switch (sourceName?.toLowerCase()) {
            case "mangaplus":
                return 5;
            case "mangadex":
                return 4;
            case "webtoon":
                return 3;
            case "nelomanga":
                return 2;
            case "manganato":
                return 1;
            default:
                return 0;
        }
    };

    const getChapterScore = (chapter: Chapter) => {
        const sourceName = chapter.sourceId ? sourceById.get(chapter.sourceId)?.sourceName : undefined;
        const sourceRank = getSourceRank(sourceName);
        const dateScore = chapter.releaseDate ? new Date(chapter.releaseDate).getTime() / 1_000_000_000_000 : 0;
        return sourceRank * 10 + dateScore;
    };

    const pickBestChapter = (candidates: Chapter[]) => {
        return [...candidates].sort((a, b) => getChapterScore(b) - getChapterScore(a))[0];
    };

    const withSourceMetadata = (chapter: Chapter, alternativeCount = 0): Chapter => ({
        ...chapter,
        sourceName: chapter.sourceId ? sourceById.get(chapter.sourceId)?.sourceName : undefined,
        alternativeCount,
    });

    const filteredChapters = selectedSourceId === "all"
        ? Array.from(
            chapters.reduce((groups, chapter) => {
                const key = Number.isFinite(chapter.chapterNumber)
                    ? chapter.chapterNumber.toFixed(3)
                    : chapter.url;
                groups.set(key, [...(groups.get(key) ?? []), chapter]);
                return groups;
            }, new Map<string, Chapter[]>()).values()
        ).map((group) => withSourceMetadata(pickBestChapter(group), group.length - 1))
        : chapters
            .filter(c => c.sourceId === selectedSourceId)
            .map((chapter) => withSourceMetadata(chapter));

    const selectedSource = initialSources.find(s => s.id === selectedSourceId);

    // Sort chapters by number desc
    const sortedChapters = [...filteredChapters].sort((a, b) => b.chapterNumber - a.chapterNumber);

    return (
        <div className="space-y-5">
            <div className="surface rounded-lg p-3 sm:p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSelectedSourceId("all")}
                        className={`ui-tab whitespace-nowrap ${selectedSourceId === "all"
                            ? "ui-tab-active"
                            : "bg-card"
                            }`}
                        aria-pressed={selectedSourceId === "all"}
                    >
                        Best Available
                    </button>
                    {initialSources.map((source) => (
                        <button
                            key={source.id}
                            onClick={() => setSelectedSourceId(source.id)}
                            className={`ui-tab whitespace-nowrap ${selectedSourceId === source.id
                                ? "ui-tab-active"
                                : "bg-card"
                                }`}
                            aria-pressed={selectedSourceId === source.id}
                        >
                            {source.sourceName}
                        </button>
                    ))}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <CheckUpdatesButton slug={slug} />
                    <RefreshMetadataButton slug={slug} />
                </div>
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

            {selectedSourceId === "all" && chapters.length !== sortedChapters.length && (
                <p className="rounded-md border bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                    Showing one best chapter per chapter number. Source-specific duplicates are still available from the provider tabs.
                </p>
            )}

            {sortedChapters.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-card/60 p-12 text-center text-muted-foreground">
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
