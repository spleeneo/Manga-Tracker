"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface ChapterItemProps {
    slug: string;
    chapter: {
        id: string;
        url: string;
        chapterNumber: number;
        releaseDate: Date | null;
        title: string | null;
        isRead: boolean;
        sourceName?: string;
        alternativeCount?: number;
    };
    currentLastReadChapterNumber: number | null;
    onProgressChange: (lastReadChapterNumber: number | null) => void;
}

export function ChapterItem({ slug, chapter, currentLastReadChapterNumber, onProgressChange }: ChapterItemProps) {
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    const toggleRead = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setLoading(true);
        const previousProgress = currentLastReadChapterNumber;
        if (!chapter.isRead) {
            onProgressChange(chapter.chapterNumber);
        }
        try {
            const res = await fetch(`/api/manga/${slug}/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: chapter.isRead ? "previous" : "set",
                    chapterNumber: chapter.chapterNumber,
                }),
            });

            if (!res.ok) throw new Error(`Progress update failed: ${res.status}`);
            const body = await res.json();
            onProgressChange(body.lastReadChapterNumber ?? null);
        } catch (error) {
            console.error(error);
            onProgressChange(previousProgress);
            showToast({
                type: "error",
                title: "Progress was not updated",
                description: "Please try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className={`interactive-surface group relative flex min-h-[132px] flex-col rounded-lg p-4 ${chapter.isRead ? 'bg-muted/35 opacity-70' : ''}`}
        >
            <div className="flex items-center justify-between mb-1">
                <a
                    href={chapter.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-sm font-bold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${chapter.isRead ? 'text-muted-foreground' : 'text-foreground'}`}
                >
                    Chapter {chapter.chapterNumber}
                </a>
                <button
                    onClick={toggleRead}
                    disabled={loading}
                    className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${chapter.isRead ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30 bg-card text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary'}`}
                    aria-label={chapter.isRead ? "Move progress before this chapter" : "Mark progress to this chapter"}
                >
                    {loading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : chapter.isRead ? (
                        <Check className="h-3 w-3" />
                    ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-transparent group-hover:bg-primary/50" />
                    )}
                </button>
            </div>

            {chapter.title && (
                <span className="mb-2 line-clamp-1 text-sm text-muted-foreground">{chapter.title}</span>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                {chapter.sourceName && (
                    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        {chapter.sourceName}
                    </span>
                )}
                {chapter.alternativeCount ? (
                    <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        +{chapter.alternativeCount} alt
                    </span>
                ) : null}
                {chapter.releaseDate && (
                    <span className="text-[10px] font-bold uppercase text-muted-foreground/70">
                        {new Date(chapter.releaseDate).toLocaleDateString()}
                    </span>
                )}
            </div>

            {chapter.isRead && <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-muted-foreground/20" />}
        </div>
    );
}
