"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarClock, CheckCircle2, Loader2, Trash2, X } from "lucide-react";
import type { LibraryMangaSummary } from "@/lib/library-summary";
import { isExternalReaderSource } from "@/lib/external-reader-sources";

export type MangaCardData = LibraryMangaSummary;

function UpdateLight({ className = "" }: { className?: string }) {
    return (
        <span
            className={`inline-flex h-3 w-3 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_3px_hsl(var(--background)),0_0_16px_hsl(142_71%_45%/0.8)] ${className}`}
            aria-label="Unread chapters available"
            title="Unread chapters available"
        />
    );
}

function MangaDeleteButton({
    title,
    removing,
    onDelete,
}: {
    title: string;
    removing?: boolean;
    onDelete: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);

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

    return (
        <>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    setIsOpen(true);
                }}
                disabled={removing}
                className="absolute -right-2 -top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_5px_12px_hsl(0_0%_0%/0.28)] transition-all hover:-translate-y-0.5 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                aria-label={`Remove ${title} from library`}
                title={`Remove ${title}`}
            >
                {removing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-3 w-3" />}
            </button>

            {isOpen ? (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4"
                    onClick={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        aria-label="Cancel remove manga"
                        className="absolute inset-0"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="modal-surface relative w-full max-w-sm rounded-lg p-5 shadow-2xl">
                        <div className="mb-4 flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                                <Trash2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold">Remove from library?</h2>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                    {title} will disappear from your list. Shared manga data stays available if you track it again.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="ui-button ui-button-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onDelete}
                                disabled={removing}
                                className="ui-button bg-red-600 text-white hover:bg-red-700"
                            >
                                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}

function formatNextChapterEstimate(manga: MangaCardData) {
    if (manga.status?.toUpperCase() !== "ONGOING" || !manga.estimatedNextChapterAt || manga.releaseEstimateSampleSize < 2) {
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

    return date < startOfToday
        ? `Expected after ${dateLabel}`
        : `Est. next ${dateLabel}`;
}

export function MangaCard({
    manga,
    loadingAction,
    removing,
    onDelete,
    onProgress,
}: {
    manga: MangaCardData;
    loadingAction?: "latest" | "catch-up" | null;
    removing?: boolean;
    onDelete: (slug: string, title: string) => void;
    onProgress: (slug: string, action: "latest" | "catch-up") => void;
}) {
    const router = useRouter();
    const progress = manga.totalChapters > 0 ? (manga.readChapters / manga.totalChapters) * 100 : 0;
    const readTarget = manga.nextUnreadChapter ?? manga.latestChapter;
    const readTargetOpensExternally = isExternalReaderSource(readTarget?.sourceName);
    const readHref = readTargetOpensExternally
        ? readTarget?.url
        : readTarget?.id ? `/manga/${manga.slug}/chapter/${readTarget.id}` : readTarget?.url;
    const readChapterNumber = readTarget?.chapterNumber;
    const isSyncing = manga.syncStatus === "SYNCING";
    const hasUnread = manga.unreadChapters > 0;
    const nextReleaseEstimate = formatNextChapterEstimate(manga);
    const openManga = () => router.push(`/manga/${manga.slug}`);

    return (
        <>
        <div
            className="interactive-surface manga-card-surface group relative flex h-32 cursor-pointer overflow-visible rounded-lg sm:hidden"
            onClick={openManga}
        >
            <Link
                href={`/manga/${manga.slug}`}
                className="relative block w-20 shrink-0 self-stretch overflow-hidden rounded-l-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open ${manga.title} details`}
            >
                {manga.coverUrl ? (
                    <img
                        src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`}
                        alt={manga.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <BookOpen className="h-8 w-8 opacity-20" />
                    </div>
                )}
                <div className="absolute bottom-0 left-0 h-1 w-full bg-black/20">
                    <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
            </Link>

            <MangaDeleteButton
                title={manga.title}
                removing={removing}
                onDelete={() => onDelete(manga.slug, manga.title)}
            />

            <div className="flex min-w-0 flex-1 flex-col p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                        {isSyncing ? (
                            <span className="mb-1 inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-foreground">
                                Syncing
                            </span>
                        ) : manga.status ? (
                            <span className="mb-1 inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                                {manga.status}
                            </span>
                        ) : null}
                        <div className="flex items-start gap-2">
                            <Link
                                href={`/manga/${manga.slug}`}
                                className="line-clamp-2 min-h-10 min-w-0 rounded-sm text-sm font-bold leading-5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title={manga.title}
                            >
                                {manga.title}
                            </Link>
                            {hasUnread ? <UpdateLight className="mt-1" /> : null}
                        </div>
                    </div>

                    {readHref ? (
                        <a
                            href={readHref}
                            target={readTargetOpensExternally ? "_blank" : undefined}
                            rel={readTargetOpensExternally ? "noopener noreferrer" : undefined}
                            onClick={(event) => event.stopPropagation()}
                            className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-bold uppercase text-foreground shadow-[0_1px_0_hsl(var(--border))] transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card"
                            title={readChapterNumber != null ? `Read chapter ${readChapterNumber}` : "Read chapter"}
                        >
                            Ch. {readChapterNumber}
                        </a>
                    ) : null}
                </div>

                <div className="mt-auto flex min-h-6 items-center justify-between gap-2 pt-3 text-[11px] font-bold uppercase text-muted-foreground">
                    <span>
                        {manga.isCaughtUp ? "Caught up" : `${manga.readChapters} / ${manga.totalChapters} read`}
                    </span>
                    {nextReleaseEstimate ? (
                        <span className="flex min-w-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-foreground">
                            <CalendarClock className="h-3 w-3 shrink-0" />
                            <span className="truncate">{nextReleaseEstimate}</span>
                        </span>
                    ) : null}
                    {isSyncing ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">
                            syncing
                        </span>
                    ) : manga.latestChapter && !manga.isCaughtUp ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onProgress(manga.slug, "catch-up");
                            }}
                            disabled={Boolean(loadingAction)}
                            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 text-[10px] font-bold uppercase text-foreground transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                            title="Mark every available chapter as read"
                        >
                            {loadingAction === "catch-up" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Catch up
                        </button>
                    ) : null}
                </div>
            </div>
        </div>

        <div
            className="interactive-surface manga-card-surface group relative hidden cursor-pointer flex-col overflow-visible rounded-lg sm:flex"
            onClick={openManga}
        >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-lg bg-muted">
                <Link
                    href={`/manga/${manga.slug}`}
                    className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Open ${manga.title} details`}
                >
                    {manga.coverUrl ? (
                        <img
                            src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`}
                            alt={manga.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <BookOpen className="h-12 w-12 opacity-20" />
                        </div>
                    )}
                </Link>

                {isSyncing && (
                    <div className="absolute left-2 top-2 flex items-center gap-2">
                        <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-bold uppercase text-foreground shadow-[0_2px_0_hsl(var(--border))] dark:bg-card">
                            Syncing
                        </span>
                    </div>
                )}

                <div className="absolute bottom-0 left-0 h-1 w-full bg-black/20">
                    <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <MangaDeleteButton
                title={manga.title}
                removing={removing}
                onDelete={() => onDelete(manga.slug, manga.title)}
            />

            <div className="flex min-h-[150px] flex-1 flex-col p-3.5">
                <div className="mb-2 flex min-h-12 items-start gap-2">
                    <Link
                        href={`/manga/${manga.slug}`}
                        className="line-clamp-2 min-w-0 rounded-sm text-base font-bold leading-6 tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title={manga.title}
                    >
                        {manga.title}
                    </Link>
                    {hasUnread ? <UpdateLight className="mt-1.5" /> : null}
                </div>

                <div className="grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[11px] font-bold uppercase text-muted-foreground">
                    <div className="flex min-w-0 items-center gap-1">
                        {manga.isCaughtUp ? (
                            <span className="flex items-center gap-1 text-foreground">
                                <CheckCircle2 className="h-3 w-3" />
                                CAUGHT UP
                            </span>
                        ) : (
                            <span>{manga.readChapters} / {manga.totalChapters} READ</span>
                        )}
                    </div>
                    {readHref ? (
                        <a
                            href={readHref}
                            target={readTargetOpensExternally ? "_blank" : undefined}
                            rel={readTargetOpensExternally ? "noopener noreferrer" : undefined}
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-full border border-border bg-background px-2 py-1 text-foreground shadow-[0_1px_0_hsl(var(--border))] transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card"
                            title={readChapterNumber != null ? `Read chapter ${readChapterNumber}` : "Read chapter"}
                        >
                            Ch. {readChapterNumber}
                        </a>
                    ) : null}
                </div>

                <div className="mt-auto pt-3">
                    {nextReleaseEstimate ? (
                        <div className="mb-2 flex min-h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-bold uppercase text-foreground">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate">{nextReleaseEstimate}</span>
                        </div>
                    ) : null}
                    {manga.latestChapter && !manga.isCaughtUp ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onProgress(manga.slug, "catch-up");
                            }}
                            disabled={Boolean(loadingAction)}
                            className="ui-button ui-button-secondary min-h-8 w-full px-2 py-1.5 text-[11px] uppercase"
                            title="Mark every available chapter as read"
                        >
                            {loadingAction === "catch-up" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            Mark caught up
                        </button>
                    ) : !manga.latestChapter ? (
                        <div className="min-h-8 rounded-md border border-dashed border-border px-2 py-1.5 text-center text-[11px] font-bold uppercase text-muted-foreground">
                        No chapters yet
                        </div>
                    ) : (
                        <div className="min-h-8" aria-hidden="true" />
                    )}
                </div>
            </div>
        </div>
        </>
    );
}
