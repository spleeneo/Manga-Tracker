"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Play, CheckCircle2, Check, ListChecks, Loader2, ExternalLink } from "lucide-react";

export interface MangaCardData {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    status: string | null;
    chapters: { id: string; chapterNumber: number; isRead: boolean; url: string; releaseDate?: Date | string | null }[];
}

export function MangaCard({ manga }: { manga: MangaCardData }) {
    const router = useRouter();
    const [loadingAction, setLoadingAction] = useState<"latest" | "catch-up" | null>(null);
    const chapterGroups = useMemo(() => {
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
                candidates: group,
                best: [...group].sort((a, b) => {
                    const bTime = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
                    const aTime = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
                    return bTime - aTime;
                })[0],
            }))
            .sort((a, b) => b.chapterNumber - a.chapterNumber);
    }, [manga.chapters]);

    const totalChapters = chapterGroups.length;
    const readChapters = chapterGroups.filter(c => c.isRead).length;
    const latestChapter = chapterGroups[0]?.best;
    const unreadChapters = totalChapters - readChapters;
    const progress = totalChapters > 0 ? (readChapters / totalChapters) * 100 : 0;
    const isCompleted = readChapters === totalChapters && totalChapters > 0;
    const latestGroup = chapterGroups[0];

    const markChaptersRead = async (chapterIds: string[], action: "latest" | "catch-up") => {
        if (chapterIds.length === 0) return;

        setLoadingAction(action);
        try {
            await Promise.all(chapterIds.map((chapterId) => (
                fetch(`/api/manga/chapter/${chapterId}/read`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isRead: true })
                })
            )));
            router.refresh();
        } catch (error) {
            console.error(error);
            alert("Failed to update reading progress");
        } finally {
            setLoadingAction(null);
        }
    };

    const markLatestRead = () => {
        if (!latestGroup) return;
        const unreadLatestIds = latestGroup.candidates
            .filter((chapter) => !chapter.isRead)
            .map((chapter) => chapter.id);
        void markChaptersRead(unreadLatestIds, "latest");
    };

    const catchUp = () => {
        const unreadIds = manga.chapters
            .filter((chapter) => !chapter.isRead)
            .map((chapter) => chapter.id);
        void markChaptersRead(unreadIds, "catch-up");
    };

    return (
        <div className="interactive-surface group flex flex-col overflow-hidden rounded-lg">
            <div className="aspect-[2/3] w-full overflow-hidden bg-muted relative">
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

                {/* Status Badge */}
                {manga.status && (
                    <div className="absolute left-2 top-2">
                        <span className={`status-pill shadow-sm ${manga.status === 'ONGOING' ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                            manga.status === 'COMPLETED' ? 'border-sky-500/25 bg-sky-500/15 text-sky-700 dark:text-sky-300' :
                                'border-amber-500/25 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}>
                            {manga.status}
                        </span>
                    </div>
                )}

                {unreadChapters > 0 && (
                    <div className="absolute right-2 top-2">
                        <span className="rounded-full border border-primary/25 bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
                            {unreadChapters} unread
                        </span>
                    </div>
                )}

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 h-1 w-full bg-black/20">
                    <div
                        className={`h-full ${isCompleted ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="flex flex-1 flex-col p-3.5">
                <Link
                    href={`/manga/${manga.slug}`}
                    className="mb-1 line-clamp-1 rounded-sm text-base font-bold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={manga.title}
                >
                    {manga.title}
                </Link>

                <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase text-muted-foreground">
                    <div className="flex items-center gap-1">
                        {isCompleted ? (
                            <span className="flex items-center gap-1 text-green-500">
                                <CheckCircle2 className="h-3 w-3" />
                                CAUGHT UP
                            </span>
                        ) : (
                            <span>{readChapters} / {totalChapters} READ</span>
                        )}
                    </div>
                    {latestChapter && (
                        <span>VOL. {latestChapter.chapterNumber}</span>
                    )}
                </div>

                {!isCompleted && latestChapter && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={markLatestRead}
                            disabled={loadingAction !== null || latestGroup?.isRead}
                            className="ui-button ui-button-secondary min-h-8 px-2 py-1.5 text-[11px] uppercase"
                            title={`Mark chapter ${latestChapter.chapterNumber} as read`}
                        >
                            {loadingAction === "latest" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Latest
                        </button>
                        <button
                            type="button"
                            onClick={catchUp}
                            disabled={loadingAction !== null}
                            className="ui-button ui-button-primary min-h-8 px-2 py-1.5 text-[11px] uppercase"
                            title="Mark all current chapters as read"
                        >
                            {loadingAction === "catch-up" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListChecks className="h-3 w-3" />}
                            Catch up
                        </button>
                    </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                    {latestChapter && (
                        <a
                            href={latestChapter.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ui-button ui-button-primary min-h-8 px-2 py-1.5 text-[11px] uppercase"
                        >
                            <Play className="h-3 w-3 fill-current" />
                            Read
                        </a>
                    )}
                    <Link
                        href={`/manga/${manga.slug}`}
                        className="ui-button ui-button-secondary min-h-8 px-2 py-1.5 text-[11px] uppercase"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Details
                    </Link>
                </div>
            </div>
        </div>
    );
}
