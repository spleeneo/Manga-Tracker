"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Play, CheckCircle2, Info, Check, ListChecks, Loader2 } from "lucide-react";

interface Manga {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    status: string | null;
    chapters: { id: string; chapterNumber: number; isRead: boolean; url: string; releaseDate?: Date | string | null }[];
}

export function MangaCard({ manga }: { manga: Manga }) {
    const router = useRouter();
    const [loadingAction, setLoadingAction] = useState<"latest" | "catch-up" | null>(null);
    const chapterGroups = useMemo(() => {
        const groups = new Map<string, Manga["chapters"]>();
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
        <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50">
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
                    <div className="absolute top-2 left-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded shadow-sm ${manga.status === 'ONGOING' ? 'bg-green-500 text-white' :
                            manga.status === 'COMPLETED' ? 'bg-blue-500 text-white' :
                                'bg-yellow-500 text-white'
                            }`}>
                            {manga.status}
                        </span>
                    </div>
                )}

                {/* Hover Action Overlay - Solid style */}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent translate-y-full transition-transform duration-300 group-hover:translate-y-0 flex gap-2">
                    {latestChapter && (
                        <a
                            href={latestChapter.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative z-20 flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Play className="h-3 w-3 fill-current" />
                            READ LATEST
                        </a>
                    )}
                    <Link
                        href={`/manga/${manga.slug}`}
                        className="relative z-20 flex items-center justify-center rounded-lg bg-white text-black p-2 hover:bg-zinc-200 transition-colors shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Info className="h-4 w-4" />
                    </Link>
                </div>

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 h-1 w-full bg-black/20">
                    <div
                        className={`h-full ${isCompleted ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-1 text-base font-bold tracking-tight mb-1" title={manga.title}>
                    {manga.title}
                </h3>

                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
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
                    <div className="relative z-20 mt-3 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={markLatestRead}
                            disabled={loadingAction !== null || latestGroup?.isRead}
                            className="inline-flex items-center justify-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            title={`Mark chapter ${latestChapter.chapterNumber} as read`}
                        >
                            {loadingAction === "latest" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Latest
                        </button>
                        <button
                            type="button"
                            onClick={catchUp}
                            disabled={loadingAction !== null}
                            className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Mark all current chapters as read"
                        >
                            {loadingAction === "catch-up" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListChecks className="h-3 w-3" />}
                            Catch up
                        </button>
                    </div>
                )}
            </div>

            {/* Main Link for accessibility/clicking anywhere else */}
            <Link href={`/manga/${manga.slug}`} className="absolute inset-0 z-10">
                <span className="sr-only">View {manga.title}</span>
            </Link>
        </div>
    );
}
