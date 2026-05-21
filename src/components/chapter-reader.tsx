"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { prefetchReaderChapter, prefetchReaderPages, scheduleReaderPrefetch } from "@/lib/reader-prefetch";

type ReaderStatus = "READABLE" | "EXTERNAL_ONLY" | "PAYWALLED" | "BLOCKED" | "UNSUPPORTED" | "ERROR";

interface ReaderPage {
  index: number;
  imageUrl: string;
  width?: number;
  height?: number;
}

interface ReaderResponse {
  status: ReaderStatus;
  pages: ReaderPage[];
  externalUrl?: string | null;
  reason?: string;
  usedAlternative?: boolean;
  chapter?: {
    id: string;
    chapterNumber: number;
    title: string | null;
    sourceName: string | null;
  };
}

interface ReaderNavChapter {
  id: string;
  chapterNumber: number;
  title: string | null;
}

interface ChapterReaderProps {
  slug: string;
  mangaTitle: string;
  chapter: {
    id: string;
    chapterNumber: number;
    title: string | null;
    url: string;
    sourceName: string | null;
  };
  previousChapter: ReaderNavChapter | null;
  nextChapter: ReaderNavChapter | null;
}

export function ChapterReader({ slug, mangaTitle, chapter, previousChapter, nextChapter }: ChapterReaderProps) {
  const [reader, setReader] = useState<ReaderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fitWidth, setFitWidth] = useState(true);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const markedReadRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const { showToast } = useToast();

  const readerUrl = useMemo(() => `/api/manga/${slug}/chapter/${chapter.id}/reader`, [chapter.id, slug]);

  const markRead = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (markedReadRef.current || isMarkingRead) return;
    markedReadRef.current = true;
    setIsMarkingRead(true);

    try {
      const res = await fetch(`/api/manga/${slug}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", chapterNumber: chapter.chapterNumber }),
      });
      if (!res.ok) throw new Error(`Progress update failed: ${res.status}`);
      if (!silent) {
        showToast({
          type: "success",
          title: `Chapter ${chapter.chapterNumber} marked read`,
        });
      }
    } catch (error) {
      markedReadRef.current = false;
      console.error(error);
      showToast({
        type: "error",
        title: "Progress was not updated",
        description: "Please try again.",
      });
    } finally {
      setIsMarkingRead(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    markedReadRef.current = false;

    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setReader(null);

      fetch(readerUrl)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.reason || data.error || `Reader failed: ${res.status}`);
          return data as ReaderResponse;
        })
        .then((data) => {
          if (!cancelled) setReader(data);
        })
        .catch((error) => {
          console.error(error);
          if (!cancelled) {
            setReader({
              status: "ERROR",
              pages: [],
              externalUrl: chapter.url,
              reason: error instanceof Error ? error.message : "Reader failed.",
            });
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chapter.url, readerUrl]);

  useEffect(() => {
    if (reader?.status !== "READABLE") return;

    const onScroll = () => {
      const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (remaining < 420) {
        void markRead({ silent: true });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader?.status]);

  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollYRef.current;
      const scrollDelta = Math.abs(currentScrollY - lastScrollYRef.current);

      if (currentScrollY < 80) {
        setIsHeaderHidden(false);
      } else if (scrollDelta > 8) {
        setIsHeaderHidden(isScrollingDown);
      }

      lastScrollYRef.current = currentScrollY;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (reader?.status !== "READABLE") return;

    const controller = new AbortController();
    void prefetchReaderPages(reader.pages, controller.signal);

    const cancelAdjacentPrefetch = scheduleReaderPrefetch(() => {
      const adjacentChapters = [nextChapter, previousChapter].filter((item): item is ReaderNavChapter => Boolean(item));
      for (const adjacentChapter of adjacentChapters) {
        void prefetchReaderChapter({
          slug,
          chapterId: adjacentChapter.id,
          signal: controller.signal,
        });
      }
    });

    return () => {
      cancelAdjacentPrefetch();
      controller.abort();
    };
  }, [nextChapter, previousChapter, reader?.pages, reader?.status, slug]);

  const displayChapter = reader?.chapter ?? chapter;
  const sourceLabel = displayChapter.sourceName ?? "Source";
  const fallbackUrl = reader?.externalUrl || chapter.url;

  return (
    <div className="min-h-screen bg-background">
      <header className={`app-header transition-transform duration-300 ease-out ${isHeaderHidden ? "-translate-y-full" : "translate-y-0"}`}>
        <div className="page-wrap flex min-h-16 flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link href={`/manga/${slug}`} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to {mangaTitle}
            </Link>
            <h1 className="mt-1 truncate text-xl font-bold md:text-2xl">
              Chapter {displayChapter.chapterNumber}
              {displayChapter.title ? `: ${displayChapter.title}` : ""}
            </h1>
            <p className="text-xs font-bold uppercase text-muted-foreground">{sourceLabel}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {previousChapter && (
              <Link href={`/manga/${slug}/chapter/${previousChapter.id}`} className="ui-button ui-button-secondary">
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Link>
            )}
            {nextChapter && (
              <Link href={`/manga/${slug}/chapter/${nextChapter.id}`} className="ui-button ui-button-secondary">
                Next
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <button type="button" className="ui-button ui-button-secondary" onClick={() => setFitWidth((value) => !value)}>
              {fitWidth ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {fitWidth ? "Original" : "Fit"}
            </button>
            <button type="button" className="ui-button ui-button-primary" onClick={() => markRead()} disabled={isMarkingRead}>
              {isMarkingRead ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Mark read
            </button>
          </div>
        </div>
      </header>

      <main className="page-wrap py-4 md:py-6">
        {isLoading ? (
          <div className="mx-auto max-w-3xl space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="surface h-[70vh] animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : reader?.status === "READABLE" ? (
          <div className={`mx-auto space-y-3 ${fitWidth ? "max-w-4xl" : "max-w-none overflow-x-auto"}`}>
            {reader.usedAlternative && (
              <div className="surface mx-auto max-w-3xl px-4 py-3 text-sm font-semibold text-muted-foreground">
                The original source could not open in Mangateo, so this reader is using {sourceLabel} for the same chapter.
              </div>
            )}
            {reader.pages.map((page) => (
              <img
                key={`${page.index}-${page.imageUrl}`}
                src={page.imageUrl}
                alt={`Chapter ${displayChapter.chapterNumber} page ${page.index + 1}`}
                className={fitWidth ? "mx-auto h-auto w-full max-w-full rounded-sm bg-card" : "mx-auto h-auto max-w-none rounded-sm bg-card"}
                loading={page.index < 2 ? "eager" : "lazy"}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2 className="text-xl font-semibold">This chapter opens on the source</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {reader?.reason || "This provider does not expose readable public pages to Mangateo yet."}
            </p>
            <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="ui-button ui-button-primary mt-4">
              <ExternalLink className="h-4 w-4" />
              Open on {sourceLabel}
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
