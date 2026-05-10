"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ChapterItem } from "./chapter-item";
import { ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";

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
    initialNextCursor: number | null;
    initialLastReadChapterNumber: number | null;
}

type ChapterMode = "best" | "all";

export function ChapterList({ slug, initialSources, initialChapters, initialNextCursor, initialLastReadChapterNumber }: ChapterListProps) {
    const [selectedSourceId, setSelectedSourceId] = useState<string | "all">("all");
    const [mode, setMode] = useState<ChapterMode>("best");
    const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
    const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor);
    const [lastReadChapterNumber, setLastReadChapterNumber] = useState<number | null>(initialLastReadChapterNumber);
    const [isLoadingPage, setIsLoadingPage] = useState(false);
    const hasLoadedInitialPage = useRef(initialChapters.length > 0);
    const { showToast } = useToast();

    const loadChapterPage = useCallback(async ({
        reset,
        cursor,
        nextMode = mode,
        nextSourceId = selectedSourceId,
    }: {
        reset: boolean;
        cursor?: number | null;
        nextMode?: ChapterMode;
        nextSourceId?: string | "all";
    }) => {
        setIsLoadingPage(true);
        try {
            const params = new URLSearchParams({
                mode: nextMode,
            });
            if (typeof cursor === "number") {
                params.set("cursor", String(cursor));
            }
            if (nextSourceId !== "all") {
                params.set("sourceId", nextSourceId);
            }

            const res = await fetch(`/api/manga/${slug}/chapters?${params.toString()}`);
            if (!res.ok) throw new Error(`Failed to load chapters: ${res.status}`);
            const data = await res.json();
            setChapters((current) => reset ? data.chapters : [...current, ...data.chapters]);
            setNextCursor(data.nextCursor ?? null);
        } catch (error) {
            console.error(error);
            showToast({
                type: "error",
                title: "Chapters did not load",
                description: "Please try again.",
            });
        } finally {
            setIsLoadingPage(false);
        }
    }, [mode, selectedSourceId, showToast, slug]);

    useEffect(() => {
        if (hasLoadedInitialPage.current) return;
        hasLoadedInitialPage.current = true;
        void loadChapterPage({ reset: true, nextMode: "best", nextSourceId: "all" });
    }, [loadChapterPage]);

    const sourceById = useMemo(() => new Map(initialSources.map((source) => [source.id, source])), [initialSources]);

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

    const progressDecoratedChapters = chapters.map((chapter) => ({
        ...chapter,
        isRead: lastReadChapterNumber != null && chapter.chapterNumber <= lastReadChapterNumber,
    }));

    const filteredChapters = mode === "best" && selectedSourceId === "all"
        ? Array.from(
            progressDecoratedChapters.reduce((groups, chapter) => {
                    const key = Number.isFinite(chapter.chapterNumber)
                        ? chapter.chapterNumber.toFixed(3)
                        : chapter.url;
                    groups.set(key, [...(groups.get(key) ?? []), chapter]);
                    return groups;
                }, new Map<string, Chapter[]>()).values()
            ).map((group) => withSourceMetadata(pickBestChapter(group), group.length - 1))
        : progressDecoratedChapters
            .filter(c => selectedSourceId === "all" || c.sourceId === selectedSourceId)
            .map((chapter) => withSourceMetadata(chapter));

    const selectedSource = initialSources.find(s => s.id === selectedSourceId);

    const sortedChapters = [...filteredChapters].sort((a, b) => b.chapterNumber - a.chapterNumber);

    const selectBest = () => {
        setMode("best");
        setSelectedSourceId("all");
        void loadChapterPage({ reset: true, nextMode: "best", nextSourceId: "all" });
    };

    const selectAll = () => {
        setMode("all");
        setSelectedSourceId("all");
        void loadChapterPage({ reset: true, nextMode: "all", nextSourceId: "all" });
    };

    const selectSource = (sourceId: string) => {
        setMode("all");
        setSelectedSourceId(sourceId);
        void loadChapterPage({ reset: true, nextMode: "all", nextSourceId: sourceId });
    };

    return (
        <div className="space-y-5">
            <div className="surface rounded-lg p-3 sm:p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={selectBest}
                        disabled={isLoadingPage}
                        className={`ui-tab whitespace-nowrap ${mode === "best" && selectedSourceId === "all"
                            ? "ui-tab-active"
                            : "bg-card"
                            }`}
                        aria-pressed={mode === "best" && selectedSourceId === "all"}
                    >
                        Best Available
                    </button>
                    <button
                        onClick={selectAll}
                        disabled={isLoadingPage}
                        className={`ui-tab whitespace-nowrap ${mode === "all" && selectedSourceId === "all"
                            ? "ui-tab-active"
                            : "bg-card"
                            }`}
                        aria-pressed={mode === "all" && selectedSourceId === "all"}
                    >
                        All Available
                    </button>
                    {initialSources.map((source) => (
                        <button
                            key={source.id}
                            onClick={() => selectSource(source.id)}
                            disabled={isLoadingPage}
                            className={`ui-tab whitespace-nowrap ${mode === "all" && selectedSourceId === source.id
                                ? "ui-tab-active"
                                : "bg-card"
                                }`}
                            aria-pressed={mode === "all" && selectedSourceId === source.id}
                        >
                            {source.sourceName}
                        </button>
                    ))}
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

            {mode === "best" && selectedSourceId === "all" && chapters.length !== sortedChapters.length && (
                <p className="rounded-md border bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                    Showing one best chapter per chapter number. Source-specific duplicates are still available from the provider tabs.
                </p>
            )}

            {mode === "all" && selectedSourceId === "all" && (
                <p className="rounded-md border bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                    Showing every available chapter from every source. Duplicates are expected when multiple providers have the same chapter.
                </p>
            )}

            {sortedChapters.length === 0 && isLoadingPage ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, index) => (
                        <div key={index} className="surface min-h-[132px] animate-pulse rounded-lg p-4">
                            <div className="h-5 w-28 rounded bg-muted" />
                            <div className="mt-4 h-4 w-44 rounded bg-muted" />
                            <div className="mt-10 flex gap-2">
                                <div className="h-5 w-20 rounded bg-muted" />
                                <div className="h-5 w-16 rounded bg-muted" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : sortedChapters.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-card/60 p-12 text-center text-muted-foreground">
                    No chapters found for this source.
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sortedChapters.map((chapter) => (
                        <ChapterItem
                            key={chapter.id}
                            slug={slug}
                            chapter={chapter}
                            currentLastReadChapterNumber={lastReadChapterNumber}
                            onProgressChange={setLastReadChapterNumber}
                        />
                    ))}
                </div>
            )}

            {nextCursor !== null && (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => void loadChapterPage({ reset: false, cursor: nextCursor })}
                        disabled={isLoadingPage}
                        className="ui-button ui-button-secondary min-w-[180px]"
                    >
                        {isLoadingPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Load more chapters
                    </button>
                </div>
            )}
        </div>
    );
}
