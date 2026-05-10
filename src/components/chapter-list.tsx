"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ChapterItem } from "./chapter-item";
import { ArrowDownUp, BookOpen, ExternalLink, Loader2, Search } from "lucide-react";
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
type SortDirection = "desc" | "asc";

export function ChapterList({ slug, initialSources, initialChapters, initialNextCursor, initialLastReadChapterNumber }: ChapterListProps) {
    const [selectedSourceId, setSelectedSourceId] = useState<string | "all">("all");
    const [mode, setMode] = useState<ChapterMode>("best");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
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
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const searchedChapters = normalizedSearch
        ? filteredChapters.filter((chapter) => {
            const sourceName = chapter.sourceName?.toLowerCase() ?? "";
            const title = chapter.title?.toLowerCase() ?? "";
            const chapterNumber = String(chapter.chapterNumber);
            return title.includes(normalizedSearch)
                || chapterNumber.includes(normalizedSearch)
                || `chapter ${chapterNumber}`.includes(normalizedSearch)
                || sourceName.includes(normalizedSearch);
        })
        : filteredChapters;

    const sortedChapters = [...searchedChapters].sort((a, b) => (
        sortDirection === "desc"
            ? b.chapterNumber - a.chapterNumber
            : a.chapterNumber - b.chapterNumber
    ));

    const chaptersByNumberAsc = [...filteredChapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
    const firstChapter = chaptersByNumberAsc[0];
    const latestChapter = chaptersByNumberAsc[chaptersByNumberAsc.length - 1];
    const firstUnreadChapter = chaptersByNumberAsc.find((chapter) => !chapter.isRead);

    const openChapter = (chapter?: Chapter) => {
        if (!chapter?.url) return;
        window.open(chapter.url, "_blank", "noopener,noreferrer");
    };

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

    const chapterControls = (
        <>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="-mx-2.5 flex gap-1.5 overflow-x-auto px-2.5 pb-1 sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0">
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

                <div className="grid gap-1.5 sm:grid-cols-[minmax(220px,1fr)_auto] sm:gap-2 xl:min-w-[520px]">
                    <label className="relative block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search chapters"
                            className="h-9 w-full rounded-md border border-border bg-background px-9 text-sm font-semibold outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring sm:h-10 dark:bg-card"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => setSortDirection((current) => current === "desc" ? "asc" : "desc")}
                        className="ui-button ui-button-secondary h-9 justify-center px-3 text-[11px] uppercase sm:h-10 sm:text-xs"
                        aria-label={`Sort chapters ${sortDirection === "desc" ? "oldest first" : "newest first"}`}
                    >
                        <ArrowDownUp className="h-4 w-4" />
                        {sortDirection === "desc" ? "Newest first" : "Oldest first"}
                    </button>
                </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:mt-3 sm:gap-2">
                <button
                    type="button"
                    onClick={() => openChapter(firstChapter)}
                    disabled={!firstChapter}
                    className="ui-button ui-button-secondary min-h-9 justify-center px-2 text-[11px] uppercase"
                >
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden min-[420px]:inline">Read </span>First
                </button>
                <button
                    type="button"
                    onClick={() => openChapter(firstUnreadChapter)}
                    disabled={!firstUnreadChapter}
                    className="ui-button ui-button-primary min-h-9 justify-center px-2 text-[11px] uppercase"
                >
                    <BookOpen className="h-4 w-4" />
                    Unread
                </button>
                <button
                    type="button"
                    onClick={() => openChapter(latestChapter)}
                    disabled={!latestChapter}
                    className="ui-button ui-button-secondary min-h-9 justify-center px-2 text-[11px] uppercase"
                >
                    <BookOpen className="h-4 w-4" />
                    Latest
                </button>
            </div>
        </>
    );

    return (
        <div className="space-y-4 sm:space-y-5">
            <div className="surface rounded-lg p-2.5 sm:p-4">
                {chapterControls}
            </div>
            {selectedSource && (
                <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <ExternalLink className="h-3 w-3" />
                    <span className="shrink-0">Source: </span>
                    <a
                        href={selectedSource.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate text-primary hover:underline"
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
