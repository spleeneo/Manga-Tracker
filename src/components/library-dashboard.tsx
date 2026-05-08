"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Clock3, Library, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { MangaCard, type MangaCardData } from "./manga-card";

type LibraryFilter = "all" | "unread" | "caught-up" | "ongoing" | "completed";

function getChapterGroups(manga: MangaCardData) {
    const groups = new Map<string, MangaCardData["chapters"]>();
    for (const chapter of manga.chapters) {
        const key = Number.isFinite(chapter.chapterNumber)
            ? chapter.chapterNumber.toFixed(3)
            : chapter.id;
        groups.set(key, [...(groups.get(key) ?? []), chapter]);
    }

    return Array.from(groups.values())
        .map((group) => ({
            chapterNumber: group[0].chapterNumber,
            isRead: group.some((chapter) => chapter.isRead),
            best: [...group].sort((a, b) => {
                const bTime = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
                const aTime = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
                return bTime - aTime;
            })[0],
        }))
        .sort((a, b) => b.chapterNumber - a.chapterNumber);
}

function getMangaSummary(manga: MangaCardData) {
    const groups = getChapterGroups(manga);
    const latest = groups[0]?.best;
    const unreadGroups = groups.filter((group) => !group.isRead);

    return {
        latest,
        latestChapterNumber: latest?.chapterNumber,
        readCount: groups.length - unreadGroups.length,
        totalCount: groups.length,
        unreadCount: unreadGroups.length,
        nextUnread: [...unreadGroups].sort((a, b) => a.chapterNumber - b.chapterNumber)[0]?.best ?? latest,
        isCaughtUp: groups.length > 0 && unreadGroups.length === 0,
    };
}

export function LibraryDashboard({ mangas }: { mangas: MangaCardData[] }) {
    const [filter, setFilter] = useState<LibraryFilter>("all");
    const summaries = useMemo(() => new Map(mangas.map((manga) => [manga.id, getMangaSummary(manga)])), [mangas]);

    const stats = useMemo(() => {
        const unreadTitles = mangas.filter((manga) => (summaries.get(manga.id)?.unreadCount ?? 0) > 0).length;
        const unreadChapters = mangas.reduce((total, manga) => total + (summaries.get(manga.id)?.unreadCount ?? 0), 0);
        const caughtUp = mangas.filter((manga) => summaries.get(manga.id)?.isCaughtUp).length;
        const ongoing = mangas.filter((manga) => manga.status?.toUpperCase() === "ONGOING").length;

        return { unreadTitles, unreadChapters, caughtUp, ongoing };
    }, [mangas, summaries]);

    const continueManga = useMemo(() => (
        [...mangas]
            .filter((manga) => (summaries.get(manga.id)?.unreadCount ?? 0) > 0)
            .sort((a, b) => {
                const aChapter = summaries.get(a.id)?.nextUnread?.releaseDate;
                const bChapter = summaries.get(b.id)?.nextUnread?.releaseDate;
                return (bChapter ? new Date(bChapter).getTime() : 0) - (aChapter ? new Date(aChapter).getTime() : 0);
            })[0] ?? mangas[0]
    ), [mangas, summaries]);

    const continueSummary = continueManga ? summaries.get(continueManga.id) : undefined;

    const filteredMangas = mangas.filter((manga) => {
        const summary = summaries.get(manga.id);
        switch (filter) {
            case "unread":
                return (summary?.unreadCount ?? 0) > 0;
            case "caught-up":
                return Boolean(summary?.isCaughtUp);
            case "ongoing":
                return manga.status?.toUpperCase() === "ONGOING";
            case "completed":
                return manga.status?.toUpperCase() === "COMPLETED";
            default:
                return true;
        }
    });

    const filters: Array<{ value: LibraryFilter; label: string; count: number }> = [
        { value: "all", label: "All", count: mangas.length },
        { value: "unread", label: "Unread", count: stats.unreadTitles },
        { value: "caught-up", label: "Caught up", count: stats.caughtUp },
        { value: "ongoing", label: "Ongoing", count: stats.ongoing },
        { value: "completed", label: "Completed", count: mangas.filter((manga) => manga.status?.toUpperCase() === "COMPLETED").length },
    ];

    return (
        <div className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="surface overflow-hidden rounded-lg p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                        <div className="flex-1">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-bold uppercase text-muted-foreground">
                                <Sparkles className="h-3.5 w-3.5" />
                                {continueSummary?.unreadCount ? "Continue reading" : "Up to date"}
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">{continueManga?.title ?? "Your library"}</h2>
                            {continueManga && continueSummary?.nextUnread ? (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {continueSummary.unreadCount > 0
                                        ? `${continueSummary.unreadCount} unread chapter${continueSummary.unreadCount === 1 ? "" : "s"} waiting. Next up: chapter ${continueSummary.nextUnread.chapterNumber}.`
                                        : `You are caught up. Latest chapter: ${continueSummary.latestChapterNumber}.`}
                                </p>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">Add a manga to start building your reading queue.</p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                                {continueSummary?.nextUnread?.url && (
                                    <a href={continueSummary.nextUnread.url} target="_blank" rel="noopener noreferrer" className="ui-button ui-button-primary">
                                        <BookOpen className="h-4 w-4" />
                                        {continueSummary.unreadCount > 0 ? `Read chapter ${continueSummary.nextUnread.chapterNumber}` : "Open latest"}
                                    </a>
                                )}
                                {continueManga && (
                                    <Link href={`/manga/${continueManga.slug}`} className="ui-button ui-button-secondary">
                                        View details
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="surface rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <Library className="h-4 w-4" />
                            Library
                        </div>
                        <p className="mt-2 text-3xl font-bold">{mangas.length}</p>
                    </div>
                    <div className="surface rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <Clock3 className="h-4 w-4" />
                            Unread
                        </div>
                        <p className="mt-2 text-3xl font-bold">{stats.unreadChapters}</p>
                    </div>
                    <div className="surface rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4" />
                            Caught up
                        </div>
                        <p className="mt-2 text-3xl font-bold">{stats.caughtUp}</p>
                    </div>
                    <div className="surface rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <BookOpen className="h-4 w-4" />
                            Ongoing
                        </div>
                        <p className="mt-2 text-3xl font-bold">{stats.ongoing}</p>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Library</h2>
                        <p className="text-sm text-muted-foreground">Filter by reading state and jump back in quickly.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {filters.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setFilter(item.value)}
                                className={`ui-tab ${filter === item.value ? "ui-tab-active" : "bg-card"}`}
                            >
                                {item.label}
                                <span className="ml-2 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{item.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {filteredMangas.length === 0 ? (
                    <div className="empty-state min-h-[260px]">
                        <h3 className="text-lg font-semibold">Nothing in this view</h3>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">Try another filter or track a new manga.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {filteredMangas.map((manga) => (
                            <MangaCard key={manga.id} manga={manga} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
