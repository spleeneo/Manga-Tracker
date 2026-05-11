"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Loader2, MoreVertical, Trash2 } from "lucide-react";
import type { LibraryMangaSummary } from "@/lib/library-summary";

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

function MangaCardMenu({
    title,
    removing,
    onDelete,
}: {
    title: string;
    removing?: boolean;
    onDelete: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const closeMenu = () => {
        setIsOpen(false);
        setIsConfirming(false);
    };

    return (
        <div
            className="absolute right-2 top-2 z-30"
            onClick={(event) => event.stopPropagation()}
        >
            <button
                type="button"
                onClick={() => {
                    if (isOpen) {
                        closeMenu();
                    } else {
                        setIsOpen(true);
                    }
                }}
                disabled={removing}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-[0_4px_14px_hsl(0_0%_0%/0.24)] transition-all hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70 dark:bg-card"
                aria-label={`Open options for ${title}`}
                title={`${title} options`}
            >
                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
            </button>

            {isOpen ? (
                <div className="absolute right-0 top-10 w-64 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-2xl">
                    {isConfirming ? (
                        <div className="space-y-3 p-2">
                            <div>
                                <p className="text-sm font-bold">Remove from library?</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {title} will disappear from your list. Shared manga data stays available if you track it again.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={closeMenu}
                                    className="ui-button ui-button-secondary min-h-8 px-2 text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    disabled={removing}
                                    className="ui-button min-h-8 bg-red-600 px-2 text-xs text-white hover:bg-red-700"
                                >
                                    {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                    Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <p className="px-2 py-1 text-[11px] font-bold uppercase text-muted-foreground">Manga options</p>
                            <button
                                type="button"
                                onClick={() => setIsConfirming(true)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <Trash2 className="h-4 w-4" />
                                Remove from library
                            </button>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
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
    const isSyncing = manga.syncStatus === "SYNCING";
    const hasUnread = manga.unreadChapters > 0;
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

            <MangaCardMenu
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

                    {readTarget ? (
                        <a
                            href={readTarget.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
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

            <MangaCardMenu
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
                    {readTarget ? (
                        <a
                            href={readTarget.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
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
