"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Loader2, X } from "lucide-react";
import type { LibraryMangaSummary } from "@/lib/library-summary";

export type MangaCardData = LibraryMangaSummary;

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
    const progress = manga.totalChapters > 0 ? (manga.readChapters / manga.totalChapters) * 100 : 0;
    const readTarget = manga.nextUnreadChapter ?? manga.latestChapter;
    const isSyncing = manga.syncStatus === "SYNCING";

    return (
        <>
        <div className="interactive-surface manga-card-surface group relative flex overflow-visible rounded-lg sm:hidden">
            <Link
                href={`/manga/${manga.slug}`}
                className="relative block h-32 w-20 shrink-0 overflow-hidden rounded-l-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onDelete(manga.slug, manga.title);
                }}
                disabled={removing}
                className="absolute -right-2 -top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full text-white shadow-[0_5px_12px_hsl(0_0%_0%/0.28)] transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                style={{ backgroundColor: "#dc2626" }}
                aria-label={`Remove ${manga.title} from library`}
                title={`Untrack ${manga.title}`}
            >
                {removing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-3 w-3" />}
            </button>

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
                        <Link
                            href={`/manga/${manga.slug}`}
                            className="line-clamp-2 min-h-10 rounded-sm text-sm font-bold leading-5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title={manga.title}
                        >
                            {manga.title}
                        </Link>
                    </div>

                    {readTarget ? (
                        <a
                            href={readTarget.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-bold uppercase text-foreground shadow-[0_1px_0_hsl(var(--border))] transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card"
                            title={`Read chapter ${readTarget.chapterNumber}`}
                        >
                            Ch. {readTarget.chapterNumber}
                        </a>
                    ) : null}
                </div>

                <div className="mt-auto flex min-h-6 items-center justify-between gap-2 pt-3 text-[11px] font-bold uppercase text-muted-foreground">
                    <span>
                        {manga.isCaughtUp ? "Caught up" : `${manga.readChapters} / ${manga.totalChapters} read`}
                    </span>
                    {isSyncing ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">
                            syncing
                        </span>
                    ) : manga.unreadChapters > 0 ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">
                            {manga.unreadChapters} unread
                        </span>
                    ) : null}
                </div>

                {manga.latestChapter && !manga.isCaughtUp ? (
                    <button
                        type="button"
                        onClick={() => onProgress(manga.slug, "catch-up")}
                        disabled={Boolean(loadingAction)}
                        className="ui-button ui-button-secondary mt-2 min-h-8 w-full px-2 py-1.5 text-[11px] uppercase"
                        title="Mark every available chapter as read"
                    >
                        {loadingAction === "catch-up" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Mark caught up
                    </button>
                ) : null}
            </div>
        </div>

        <div className="interactive-surface manga-card-surface group relative hidden flex-col overflow-visible rounded-lg sm:flex">
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

                {(isSyncing || manga.status) && (
                    <div className="absolute left-2 top-2">
                        <span className="status-pill cover-status-pill">
                            {isSyncing ? "SYNCING" : manga.status}
                        </span>
                    </div>
                )}

                {manga.unreadChapters > 0 && (
                    <div className="absolute bottom-3 right-2">
                        <span className="rounded-full border border-border bg-card px-2 py-1 text-[11px] font-bold text-foreground shadow-[0_2px_0_hsl(var(--border))] dark:bg-muted dark:text-foreground">
                            {manga.unreadChapters} unread
                        </span>
                    </div>
                )}

                <div className="absolute bottom-0 left-0 h-1 w-full bg-black/20">
                    <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onDelete(manga.slug, manga.title);
                }}
                disabled={removing}
                className="absolute -right-2 -top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full text-white shadow-[0_5px_12px_hsl(0_0%_0%/0.28)] transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                style={{ backgroundColor: "#dc2626" }}
                aria-label={`Remove ${manga.title} from library`}
                title={`Untrack ${manga.title}`}
            >
                {removing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-3 w-3" />}
            </button>

            <div className="flex min-h-[150px] flex-1 flex-col p-3.5">
                <Link
                    href={`/manga/${manga.slug}`}
                    className="mb-2 line-clamp-2 min-h-12 rounded-sm text-base font-bold leading-6 tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={manga.title}
                >
                    {manga.title}
                </Link>

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
                    {readTarget ? (
                        <a
                            href={readTarget.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-border bg-background px-2 py-1 text-foreground shadow-[0_1px_0_hsl(var(--border))] transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card"
                            title={`Read chapter ${readTarget.chapterNumber}`}
                        >
                            Ch. {readTarget.chapterNumber}
                        </a>
                    ) : null}
                </div>

                <div className="mt-auto pt-3">
                    {manga.latestChapter && !manga.isCaughtUp ? (
                        <button
                            type="button"
                            onClick={() => onProgress(manga.slug, "catch-up")}
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
