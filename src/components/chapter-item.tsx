"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ChapterItemProps {
    chapter: {
        id: string;
        url: string;
        chapterNumber: number;
        releaseDate: Date | null;
        title: string | null;
        isRead: boolean;
    };
}

export function ChapterItem({ chapter }: ChapterItemProps) {
    const [isRead, setIsRead] = useState(chapter.isRead);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const toggleRead = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setLoading(true);
        try {
            const res = await fetch(`/api/manga/chapter/${chapter.id}/read`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isRead: !isRead })
            });

            if (res.ok) {
                setIsRead(!isRead);
                router.refresh();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <a
            href={chapter.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative flex flex-col rounded-lg border p-4 transition-all hover:bg-accent hover:shadow-md ${isRead ? 'opacity-60 bg-muted/30' : 'bg-card'}`}
        >
            <div className="flex items-center justify-between mb-1">
                <span className={`font-bold ${isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                    Chapter {chapter.chapterNumber}
                </span>
                <button
                    onClick={toggleRead}
                    disabled={loading}
                    className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${isRead ? 'bg-primary border-primary text-primary-foreground' : 'hover:border-primary hover:text-primary border-muted-foreground/30'}`}
                >
                    {loading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isRead ? (
                        <Check className="h-3 w-3" />
                    ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-transparent group-hover:bg-primary/50" />
                    )}
                </button>
            </div>

            {chapter.title && (
                <span className="text-sm text-muted-foreground line-clamp-1 mb-2">{chapter.title}</span>
            )}

            {chapter.releaseDate && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mt-auto">
                    {new Date(chapter.releaseDate).toLocaleDateString()}
                </span>
            )}

            {isRead && <div className="absolute inset-0 bg-background/5 pointer-events-none rounded-lg" />}
        </a>
    );
}
