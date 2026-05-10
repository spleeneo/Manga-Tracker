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

    return (
        <div className="interactive-surface group relative flex flex-col overflow-visible rounded-lg">
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

                {manga.status && (
                    <div className="absolute left-2 top-2">
                        <span className="status-pill cover-status-pill">
                            {manga.status}
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
                className="absolute -right-3 -top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-foreground text-background shadow-[0_0_0_3px_hsl(var(--card)),0_8px_20px_hsl(0_0%_0%/0.36)] transition-all hover:-translate-y-0.5 hover:border-destructive-foreground hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70 dark:border-card dark:bg-foreground dark:text-background"
                aria-label={`Remove ${manga.title} from library`}
                title={`Untrack ${manga.title}`}
            >
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-4 w-4" />}
            </button>

            <div className="flex flex-1 flex-col p-3.5">
                <Link
                    href={`/manga/${manga.slug}`}
                    className="mb-1 line-clamp-2 rounded-sm text-base font-bold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={manga.title}
                >
                    {manga.title}
                </Link>

                <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase text-muted-foreground">
                    <div className="flex items-center gap-1">
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

                {manga.latestChapter && !manga.isCaughtUp ? (
                    <button
                        type="button"
                        onClick={() => onProgress(manga.slug, "catch-up")}
                        disabled={Boolean(loadingAction)}
                        className="ui-button ui-button-secondary mt-3 min-h-8 w-full px-2 py-1.5 text-[11px] uppercase"
                        title="Mark every available chapter as read"
                    >
                        {loadingAction === "catch-up" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Mark caught up
                    </button>
                ) : null}

                {!manga.latestChapter ? (
                    <div className="mt-3 min-h-8 rounded-md border border-dashed border-border px-2 py-1.5 text-center text-[11px] font-bold uppercase text-muted-foreground">
                        No chapters yet
                    </div>
                ) : null}
            </div>
        </div>
    );
}
