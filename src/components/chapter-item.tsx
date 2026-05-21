"use client";

import { useState } from "react";
import { Check, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { isExternalReaderSource } from "@/lib/external-reader-sources";

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
    readerStatus?: string | null;
  };
  currentLastReadChapterNumber: number | null;
  onProgressChange: (lastReadChapterNumber: number | null) => void;
}

export function ChapterItem({ slug, chapter, currentLastReadChapterNumber, onProgressChange }: ChapterItemProps) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const readerHref = `/manga/${slug}/chapter/${chapter.id}`;
  const opensExternally = isExternalReaderSource(chapter.sourceName);
  const isCurrentLastRead = currentLastReadChapterNumber === chapter.chapterNumber;

  const openChapter = () => {
    window.location.assign(opensExternally ? chapter.url : readerHref);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openChapter();
  };

  const updateProgress = async ({
    action,
    optimisticChapterNumber,
    successTitle,
  }: {
    action: "set" | "previous";
    optimisticChapterNumber: number | null;
    successTitle?: string;
  }) => {
    setLoading(true);
    const previousProgress = currentLastReadChapterNumber;
    onProgressChange(optimisticChapterNumber);

    try {
      const res = await fetch(`/api/manga/${slug}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          chapterNumber: chapter.chapterNumber,
        }),
      });

      if (!res.ok) throw new Error(`Progress update failed: ${res.status}`);
      const body = await res.json();
      onProgressChange(body.lastReadChapterNumber ?? null);

      if (successTitle) {
        showToast({
          type: "success",
          title: successTitle,
        });
      }
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

  const toggleRead = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    void updateProgress({
      action: chapter.isRead ? "previous" : "set",
      optimisticChapterNumber: chapter.isRead ? currentLastReadChapterNumber : chapter.chapterNumber,
    });
  };

  const setLastRead = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (isCurrentLastRead) return;

    void updateProgress({
      action: "set",
      optimisticChapterNumber: chapter.chapterNumber,
      successTitle: `Last read set to chapter ${chapter.chapterNumber}`,
    });
  };

  return (
    <article
      className={`interactive-surface group relative flex min-h-[160px] cursor-pointer flex-col rounded-lg p-4 ${chapter.isRead ? "bg-muted/35 opacity-70" : ""}`}
      onClick={openChapter}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`Open chapter ${chapter.chapterNumber}${opensExternally ? ` on ${chapter.sourceName}` : " in Mangateo"}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`pointer-events-none relative z-10 rounded-sm font-bold transition-colors group-hover:text-primary ${chapter.isRead ? "text-muted-foreground" : "text-foreground"}`}
        >
          Chapter {chapter.chapterNumber}
        </span>
        <button
          type="button"
          onClick={toggleRead}
          disabled={loading}
          className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${chapter.isRead ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 bg-card text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary"}`}
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
        <span className="pointer-events-none relative z-10 mb-2 line-clamp-1 text-sm text-muted-foreground">
          {chapter.title}
        </span>
      )}

      <div className="pointer-events-none relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-2">
        {chapter.sourceName && (
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
            {chapter.sourceName}
            {opensExternally ? " external" : ""}
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

      <button
        type="button"
        onClick={setLastRead}
        disabled={loading || isCurrentLastRead}
        className={`relative z-10 mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isCurrentLastRead
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card hover:border-primary hover:bg-primary hover:text-primary-foreground"
        }`}
        aria-label={`Set chapter ${chapter.chapterNumber} as last read`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {isCurrentLastRead ? "Last read" : "Set last read"}
      </button>

      {chapter.isRead && <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-muted-foreground/20" />}
    </article>
  );
}
