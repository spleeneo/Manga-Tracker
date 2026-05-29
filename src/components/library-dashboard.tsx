"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Clock3, Library, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { MangaCard, type MangaCardData } from "./manga-card";
import { useToast } from "@/components/toast-provider";
import { isExternalReaderSource } from "@/lib/external-reader-sources";

type LibraryFilter = "all" | "unread" | "caught-up" | "ongoing" | "completed";
type ProgressAction = "next" | "latest" | "caught-up" | "catch-up";

function formatNextChapterEstimate(manga?: MangaCardData) {
    if (!manga || manga.status?.toUpperCase() !== "ONGOING" || !manga.estimatedNextChapterAt || manga.releaseEstimateSampleSize < 2) {
        return null;
    }

    const date = new Date(manga.estimatedNextChapterAt);
    if (Number.isNaN(date.getTime())) return null;

    const dateLabel = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(date);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const cadence = manga.releaseCadenceDays ? `, about every ${Math.round(manga.releaseCadenceDays)} days` : "";

    return date < startOfToday
        ? `Next chapter is overdue based on recent releases${cadence}. Last estimate was ${dateLabel}.`
        : `Next chapter is estimated around ${dateLabel}${cadence}.`;
}

export function LibraryDashboard({ mangas }: { mangas: MangaCardData[] }) {
    const [items, setItems] = useState(mangas);
    const [filter, setFilter] = useState<LibraryFilter>("all");
    const [progressAction, setProgressAction] = useState<{ slug: string; action: ProgressAction } | null>(null);
    const [removingSlug, setRemovingSlug] = useState<string | null>(null);
    const { showToast } = useToast();

    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            const unreadPriority = Number(b.unreadChapters > 0) - Number(a.unreadChapters > 0);
            if (unreadPriority !== 0) return unreadPriority;

            const aTime = a.latestAvailableAt ?? a.latestChapter?.releaseDate;
            const bTime = b.latestAvailableAt ?? b.latestChapter?.releaseDate;
            const byUpdate = (bTime ? new Date(bTime).getTime() : 0) - (aTime ? new Date(aTime).getTime() : 0);
            if (byUpdate !== 0) return byUpdate;
            return (b.latestChapter?.chapterNumber ?? 0) - (a.latestChapter?.chapterNumber ?? 0);
        });
    }, [items]);

    const stats = useMemo(() => {
        const unreadTitles = items.filter((manga) => manga.unreadChapters > 0).length;
        const unreadChapters = items.reduce((total, manga) => total + manga.unreadChapters, 0);
        const caughtUp = items.filter((manga) => manga.isCaughtUp).length;
        const ongoing = items.filter((manga) => manga.status?.toUpperCase() === "ONGOING").length;

        return { unreadTitles, unreadChapters, caughtUp, ongoing };
    }, [items]);

    const continueManga = useMemo(() => {
        const lastReadManga = [...items]
            .filter((manga) => manga.lastReadAt)
            .sort((a, b) => new Date(b.lastReadAt ?? 0).getTime() - new Date(a.lastReadAt ?? 0).getTime())[0];

        if (lastReadManga) return lastReadManga;

        return [...sortedItems]
            .filter((manga) => manga.unreadChapters > 0)
            .sort((a, b) => {
                const aChapter = a.nextUnreadChapter?.releaseDate;
                const bChapter = b.nextUnreadChapter?.releaseDate;
                return (bChapter ? new Date(bChapter).getTime() : 0) - (aChapter ? new Date(aChapter).getTime() : 0);
            })[0] ?? sortedItems[0];
    }, [items, sortedItems]);
    const continueReadTarget = continueManga?.nextUnreadChapter ?? continueManga?.latestChapter;
    const continueReadOpensExternally = isExternalReaderSource(continueReadTarget?.sourceName);
    const continueReadHref = continueManga && continueReadTarget
        ? continueReadOpensExternally
            ? continueReadTarget.url
            : continueReadTarget.id
            ? `/manga/${continueManga.slug}/chapter/${continueReadTarget.id}`
            : continueReadTarget.url
        : null;
    const continueNextEstimate = formatNextChapterEstimate(continueManga);

    const filteredMangas = sortedItems.filter((manga) => {
        switch (filter) {
            case "unread":
                return manga.unreadChapters > 0;
            case "caught-up":
                return manga.isCaughtUp;
            case "ongoing":
                return manga.status?.toUpperCase() === "ONGOING";
            case "completed":
                return manga.status?.toUpperCase() === "COMPLETED";
            default:
                return true;
        }
    });

    const filters: Array<{ value: LibraryFilter; label: string; count: number }> = [
        { value: "all", label: "All", count: items.length },
        { value: "unread", label: "Unread", count: stats.unreadTitles },
        { value: "caught-up", label: "Caught up", count: stats.caughtUp },
        { value: "ongoing", label: "Ongoing", count: stats.ongoing },
        { value: "completed", label: "Completed", count: items.filter((manga) => manga.status?.toUpperCase() === "COMPLETED").length },
    ];

    const updateMangaSummary = (summary: MangaCardData) => {
        setItems((current) => current.map((manga) => manga.id === summary.id ? summary : manga));
    };

    const markProgress = async (slug: string, action: ProgressAction) => {
        const previousItems = items;
        const target = items.find((manga) => manga.slug === slug);
        if (target && action === "caught-up") {
            setItems((current) => current.map((manga) => (
                manga.slug === slug
                    ? {
                        ...manga,
                        lastReadChapterNumber: manga.latestChapter?.chapterNumber ?? manga.lastReadChapterNumber,
                        readChapters: manga.totalChapters,
                        unreadChapters: 0,
                        isCaughtUp: manga.totalChapters > 0,
                        nextUnreadChapter: null,
                    }
                    : manga
            )));
        }

        setProgressAction({ slug, action });
        try {
            const apiAction = action === "next" ? "next" : "caught-up";
            const res = await fetch(`/api/manga/${slug}/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: apiAction }),
            });
            if (!res.ok) throw new Error(`Progress update failed: ${res.status}`);
            const body = await res.json();
            updateMangaSummary(body.summary);
        } catch (error) {
            console.error(error);
            setItems(previousItems);
            showToast({
                type: "error",
                title: "Progress was not updated",
                description: "Please try again.",
            });
        } finally {
            setProgressAction(null);
        }
    };

    const deleteManga = async (slug: string) => {
        setRemovingSlug(slug);
        const previousItems = items;
        setItems((current) => current.filter((manga) => manga.slug !== slug));
        try {
            const res = await fetch(`/api/manga/${slug}/library`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error(`Remove failed: ${res.status}`);
        } catch (error) {
            console.error(error);
            setItems(previousItems);
            showToast({
                type: "error",
                title: "Manga was not removed",
                description: "Please try again.",
            });
        } finally {
            setRemovingSlug(null);
        }
    };

    return (
        <div className="space-y-6">
            <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="surface overflow-hidden rounded-lg p-4 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                        <div className="flex-1">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-bold uppercase text-muted-foreground">
                                <Sparkles className="h-3.5 w-3.5" />
                                {continueManga?.unreadChapters ? "Continue reading" : "Up to date"}
                            </div>
                            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{continueManga?.title ?? "Your library"}</h2>
                            {continueManga?.latestChapter ? (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {continueManga.unreadChapters > 0 && continueManga.nextUnreadChapter
                                        ? `${continueManga.unreadChapters} unread chapter${continueManga.unreadChapters === 1 ? "" : "s"} waiting. Next up: chapter ${continueManga.nextUnreadChapter.chapterNumber}.`
                                        : `You are caught up. Latest chapter: ${continueManga.latestChapter.chapterNumber}.`}
                                </p>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">Add a manga to start building your reading queue.</p>
                            )}
                            {continueNextEstimate ? (
                                <p className="mt-2 max-w-xl rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">
                                    {continueNextEstimate}
                                </p>
                            ) : null}
                            <div className="mt-4 grid gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap">
                                {continueReadHref && (
                                    <a
                                        href={continueReadHref}
                                        target={continueReadOpensExternally ? "_blank" : undefined}
                                        rel={continueReadOpensExternally ? "noopener noreferrer" : undefined}
                                        className="ui-button ui-button-primary"
                                    >
                                        <BookOpen className="h-4 w-4" />
                                        {continueManga?.unreadChapters && continueManga.nextUnreadChapter
                                            ? `Read chapter ${continueManga.nextUnreadChapter.chapterNumber}`
                                            : "Open latest"}
                                    </a>
                                )}
                                {continueManga && (
                                    <Link href={`/manga/${continueManga.slug}`} className="ui-button ui-button-secondary">
                                        View details
                                    </Link>
                                )}
                                {continueManga && continueManga.unreadChapters > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => void markProgress(continueManga.slug, "caught-up")}
                                        disabled={progressAction !== null}
                                        className="ui-button ui-button-secondary"
                                        title="Mark every available chapter as read"
                                    >
                                        {progressAction?.slug === continueManga.slug && progressAction.action === "caught-up" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        Mark caught up
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3">
                    <div className="surface rounded-lg p-2.5 sm:p-4">
                        <div className="flex flex-col items-center gap-1 text-center text-[11px] font-semibold text-muted-foreground sm:flex-row sm:gap-2 sm:text-left sm:text-sm">
                            <Library className="h-4 w-4" />
                            Library
                        </div>
                        <p className="mt-1 text-center text-2xl font-bold sm:mt-2 sm:text-left sm:text-3xl">{items.length}</p>
                    </div>
                    <div className="surface rounded-lg p-2.5 sm:p-4">
                        <div className="flex flex-col items-center gap-1 text-center text-[11px] font-semibold text-muted-foreground sm:flex-row sm:gap-2 sm:text-left sm:text-sm">
                            <Clock3 className="h-4 w-4" />
                            Unread
                        </div>
                        <p className="mt-1 text-center text-2xl font-bold sm:mt-2 sm:text-left sm:text-3xl">{stats.unreadChapters}</p>
                    </div>
                    <div className="surface rounded-lg p-2.5 sm:p-4">
                        <div className="flex flex-col items-center gap-1 text-center text-[11px] font-semibold text-muted-foreground sm:flex-row sm:gap-2 sm:text-left sm:text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            Caught up
                        </div>
                        <p className="mt-1 text-center text-2xl font-bold sm:mt-2 sm:text-left sm:text-3xl">{stats.caughtUp}</p>
                    </div>
                    <div className="surface rounded-lg p-2.5 sm:p-4">
                        <div className="flex flex-col items-center gap-1 text-center text-[11px] font-semibold text-muted-foreground sm:flex-row sm:gap-2 sm:text-left sm:text-sm">
                            <BookOpen className="h-4 w-4" />
                            Ongoing
                        </div>
                        <p className="mt-1 text-center text-2xl font-bold sm:mt-2 sm:text-left sm:text-3xl">{stats.ongoing}</p>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Library</h2>
                        <p className="text-sm text-muted-foreground">Filter by reading state and jump back in quickly.</p>
                    </div>
                    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {filteredMangas.map((manga) => (
                            <MangaCard
                                key={manga.id}
                                manga={manga}
                                loadingAction={progressAction?.slug === manga.slug ? progressAction.action === "caught-up" ? "catch-up" : "latest" : null}
                                removing={removingSlug === manga.slug}
                                onDelete={(slug) => void deleteManga(slug)}
                                onProgress={markProgress}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
