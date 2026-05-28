"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { prefetchReaderChapter, prefetchReaderPages, scheduleReaderPrefetch } from "@/lib/reader-prefetch";

type ReaderStatus = "READABLE" | "EXTERNAL_ONLY" | "PAYWALLED" | "BLOCKED" | "UNSUPPORTED" | "ERROR";

const MARK_READ_THRESHOLD_PX = 420;
const APPEND_CHAPTER_THRESHOLD_PX = 1400;
const NEXT_CHAPTER_BATCH_SIZE = 1;
const READER_WINDOW_BEFORE = 1;
const READER_WINDOW_AFTER = 1;

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

interface ReaderStreamChapter extends ReaderNavChapter {
  url: string;
  sourceName: string | null;
}

interface LoadedReaderChapter {
  chapter: ReaderStreamChapter;
  reader: ReaderResponse | null;
  isLoading: boolean;
}

interface ChapterReaderProps {
  slug: string;
  mangaTitle: string;
  chapter: ReaderStreamChapter;
  previousChapter: ReaderNavChapter | null;
  nextChapters: ReaderStreamChapter[];
}

export function ChapterReader({ slug, mangaTitle, chapter, previousChapter, nextChapters }: ChapterReaderProps) {
  const [nextChapterQueue, setNextChapterQueue] = useState(nextChapters);
  const [loadedChapters, setLoadedChapters] = useState<LoadedReaderChapter[]>([{
    chapter,
    reader: null,
    isLoading: true,
  }]);
  const [activeChapterId, setActiveChapterId] = useState(chapter.id);
  const [fitWidth, setFitWidth] = useState(true);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const markedReadRef = useRef(new Set<number>());
  const activeChapterIdRef = useRef(chapter.id);
  const nextChapterQueueRef = useRef(nextChapters);
  const loadedChaptersRef = useRef<LoadedReaderChapter[]>([{
    chapter,
    reader: null,
    isLoading: true,
  }]);
  const loadingChapterIdsRef = useRef(new Set<string>());
  const isLoadingNextChaptersRef = useRef(false);
  const hasMoreNextChaptersRef = useRef(nextChapters.length >= NEXT_CHAPTER_BATCH_SIZE);
  const lastScrollYRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const upwardScrollDistanceRef = useRef(0);
  const sourceRedirectedRef = useRef(false);
  const { showToast } = useToast();

  const activeIndex = loadedChapters.findIndex((item) => item.chapter.id === activeChapterId);
  const activeLoadedChapter = loadedChapters[activeIndex >= 0 ? activeIndex : 0] ?? loadedChapters[0];
  const previousNavChapter = activeIndex > 0 ? loadedChapters[activeIndex - 1]?.chapter : previousChapter;
  const nextChapter = activeIndex >= 0 ? (loadedChapters[activeIndex + 1]?.chapter ?? nextChapterQueue[activeIndex]) : nextChapterQueue[0];
  const firstReader = loadedChapters[0]?.reader;
  const firstChapterLoading = loadedChapters[0]?.isLoading ?? true;

  const fetchReader = useCallback(async (targetChapter: ReaderStreamChapter, signal?: AbortSignal): Promise<ReaderResponse> => {
    const res = await fetch(`/api/manga/${slug}/chapter/${targetChapter.id}/reader`, { signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.reason || data.error || `Reader failed: ${res.status}`);
    return data as ReaderResponse;
  }, [slug]);

  useEffect(() => {
    loadedChaptersRef.current = loadedChapters;
  }, [loadedChapters]);

  useEffect(() => {
    activeChapterIdRef.current = activeChapterId;
  }, [activeChapterId]);

  useEffect(() => {
    nextChapterQueueRef.current = nextChapterQueue;
  }, [nextChapterQueue]);

  const keepReaderWindow = useCallback((items: LoadedReaderChapter[], anchorChapterId: string) => {
    const anchorIndex = items.findIndex((item) => item.chapter.id === anchorChapterId);
    if (anchorIndex === -1) return items;

    const start = Math.max(0, anchorIndex - READER_WINDOW_BEFORE);
    const end = Math.min(items.length, anchorIndex + READER_WINDOW_AFTER + 1);
    if (start === 0 && end === items.length) return items;

    const anchorSection = document.querySelector<HTMLElement>(`[data-reader-chapter-id="${anchorChapterId}"]`);
    const anchorTop = anchorSection?.getBoundingClientRect().top;
    const keptItems = items.slice(start, end);

    if (anchorTop != null) {
      window.requestAnimationFrame(() => {
        const nextAnchorSection = document.querySelector<HTMLElement>(`[data-reader-chapter-id="${anchorChapterId}"]`);
        const nextAnchorTop = nextAnchorSection?.getBoundingClientRect().top;
        if (nextAnchorTop != null) {
          window.scrollBy(0, nextAnchorTop - anchorTop);
          lastScrollYRef.current = window.scrollY;
        }
      });
    }

    return keptItems;
  }, []);

  const markRead = async (targetChapter = activeLoadedChapter?.chapter, { silent = false }: { silent?: boolean } = {}) => {
    if (!targetChapter || markedReadRef.current.has(targetChapter.chapterNumber) || isMarkingRead) return;
    markedReadRef.current.add(targetChapter.chapterNumber);
    setIsMarkingRead(true);

    try {
      const res = await fetch(`/api/manga/${slug}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", chapterNumber: targetChapter.chapterNumber }),
      });
      if (!res.ok) throw new Error(`Progress update failed: ${res.status}`);
      if (!silent) {
        showToast({
          type: "success",
          title: `Chapter ${targetChapter.chapterNumber} marked read`,
        });
      }
    } catch (error) {
      markedReadRef.current.delete(targetChapter.chapterNumber);
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

  const loadChapter = useCallback((targetChapter: ReaderStreamChapter) => {
    if (loadingChapterIdsRef.current.has(targetChapter.id)) return;
    const existingChapter = loadedChaptersRef.current.find((item) => item.chapter.id === targetChapter.id);
    if (existingChapter?.reader) return;

    loadingChapterIdsRef.current.add(targetChapter.id);
    if (!existingChapter) {
      setLoadedChapters((current) => (
        keepReaderWindow([
          ...current,
          { chapter: targetChapter, reader: null, isLoading: true },
        ], activeChapterIdRef.current)
      ));
    } else if (!existingChapter.isLoading) {
      setLoadedChapters((current) => current.map((item) => (
        item.chapter.id === targetChapter.id ? { ...item, isLoading: true } : item
      )));
    }

    const controller = new AbortController();
    fetchReader(targetChapter, controller.signal)
      .then((data) => {
        setLoadedChapters((current) => (
          keepReaderWindow(current.map((item) => (
            item.chapter.id === targetChapter.id ? { ...item, reader: data, isLoading: false } : item
          )), activeChapterIdRef.current)
        ));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setLoadedChapters((current) => (
          keepReaderWindow(current.map((item) => (
            item.chapter.id === targetChapter.id
              ? {
                  ...item,
                  isLoading: false,
                  reader: {
                    status: "ERROR",
                    pages: [],
                    externalUrl: targetChapter.url,
                    reason: error instanceof Error ? error.message : "Reader failed.",
                  },
                }
              : item
          )), activeChapterIdRef.current)
        ));
      })
      .finally(() => {
        loadingChapterIdsRef.current.delete(targetChapter.id);
      });

    return () => controller.abort();
  }, [fetchReader, keepReaderWindow]);

  const loadMoreNextChapters = useCallback(async () => {
    if (isLoadingNextChaptersRef.current || !hasMoreNextChaptersRef.current) return null;

    const currentQueue = nextChapterQueueRef.current;
    const afterChapterId = currentQueue[currentQueue.length - 1]?.id ?? chapter.id;
    isLoadingNextChaptersRef.current = true;

    try {
      const params = new URLSearchParams({ limit: String(NEXT_CHAPTER_BATCH_SIZE) });
      const res = await fetch(`/api/manga/${slug}/chapter/${afterChapterId}/next?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Next chapters failed: ${res.status}`);

      const incoming = Array.isArray(data.chapters) ? data.chapters as ReaderStreamChapter[] : [];
      hasMoreNextChaptersRef.current = Boolean(data.hasMore);

      const seen = new Set(currentQueue.map((item) => item.id));
      const additions = incoming.filter((item) => !seen.has(item.id));
      const firstNewChapter = additions[0] ?? null;
      if (additions.length > 0) {
        const updated = [...currentQueue, ...additions];
        nextChapterQueueRef.current = updated;
        setNextChapterQueue(updated);
      }

      return firstNewChapter;
    } catch (error) {
      console.error(error);
      hasMoreNextChaptersRef.current = false;
      return null;
    } finally {
      isLoadingNextChaptersRef.current = false;
    }
  }, [chapter.id, slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadChapter(chapter);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [chapter, loadChapter]);

  useEffect(() => {
    if (sourceRedirectedRef.current || firstChapterLoading || !firstReader) return;
    if (firstReader.status === "READABLE") return;

    sourceRedirectedRef.current = true;
    window.open(firstReader.externalUrl || chapter.url, "_blank", "noopener,noreferrer");
  }, [chapter.url, firstChapterLoading, firstReader]);

  useEffect(() => {
    const updateActiveChapterForScroll = (currentLoadedChapters: LoadedReaderChapter[]) => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-reader-chapter-id]"));
      if (sections.length === 0) return;

      const readingLine = window.innerHeight * 0.35;
      const currentSection = sections.reduce((current, section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= readingLine ? section : current;
      }, sections[0]);
      const nextActiveId = currentSection.getAttribute("data-reader-chapter-id");
      if (!nextActiveId) return;

      const nextActiveChapter = currentLoadedChapters.find((item) => item.chapter.id === nextActiveId)?.chapter;
      const nextPath = nextActiveChapter ? `/manga/${slug}/chapter/${nextActiveChapter.id}` : null;
      if (nextPath && window.location.pathname !== nextPath) {
        window.history.replaceState(null, "", nextPath);
      }

      activeChapterIdRef.current = nextActiveId;
      setActiveChapterId((current) => (current === nextActiveId ? current : nextActiveId));
      setLoadedChapters((current) => keepReaderWindow(current, nextActiveId));
    };

    const runScrollWork = () => {
      scrollFrameRef.current = null;
      const currentLoadedChapters = loadedChaptersRef.current;
      const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      updateActiveChapterForScroll(currentLoadedChapters);

      if (remaining < MARK_READ_THRESHOLD_PX) {
        void markRead(activeLoadedChapter?.chapter, { silent: true });
      }

      if (remaining < APPEND_CHAPTER_THRESHOLD_PX) {
        const currentNextChapters = nextChapterQueueRef.current;
        const activeChapter = currentLoadedChapters.find((item) => item.chapter.id === activeChapterIdRef.current)?.chapter;
        const immediateNextChapter = activeChapter
          ? currentNextChapters.find((candidate) => (
            candidate.chapterNumber > activeChapter.chapterNumber
          ))
          : null;
        const isImmediateNextLoaded = immediateNextChapter
          ? currentLoadedChapters.some((item) => item.chapter.id === immediateNextChapter.id)
            || loadingChapterIdsRef.current.has(immediateNextChapter.id)
          : false;
        if (immediateNextChapter && !isImmediateNextLoaded) {
          loadChapter(immediateNextChapter);
        } else if (!immediateNextChapter) {
          void loadMoreNextChapters().then((chapterToLoad) => {
            if (chapterToLoad) loadChapter(chapterToLoad);
          });
        }
      }

      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollYRef.current;
      const scrollDelta = Math.abs(currentScrollY - lastScrollYRef.current);

      if (currentScrollY < 80) {
        upwardScrollDistanceRef.current = 0;
        setIsHeaderHidden(false);
      } else if (isScrollingDown && scrollDelta > 6) {
        upwardScrollDistanceRef.current = 0;
        setIsHeaderHidden(true);
      } else if (!isScrollingDown) {
        upwardScrollDistanceRef.current += scrollDelta;
        if (upwardScrollDistanceRef.current > 180) {
          setIsHeaderHidden(false);
          upwardScrollDistanceRef.current = 0;
        }
      }

      lastScrollYRef.current = currentScrollY;
    };

    const onScroll = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = window.requestAnimationFrame(runScrollWork);
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    runScrollWork();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLoadedChapter?.chapter, loadChapter, loadMoreNextChapters, slug]);

  useEffect(() => {
    const activeReader = activeLoadedChapter?.reader;
    if (activeReader?.status !== "READABLE" || activeReader.pages.length === 0) return;

    const controller = new AbortController();
    void prefetchReaderPages(activeReader.pages, controller.signal);

    const cancelAdjacentPrefetch = scheduleReaderPrefetch(() => {
      const adjacentChapters = [nextChapter, previousNavChapter].filter((item): item is ReaderNavChapter => Boolean(item));
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
  }, [activeLoadedChapter?.reader, nextChapter, previousNavChapter, slug]);

  const displayChapter = activeLoadedChapter?.reader?.chapter ?? activeLoadedChapter?.chapter ?? chapter;
  const sourceLabel = displayChapter.sourceName ?? "Source";

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
            {previousNavChapter && (
              <Link href={`/manga/${slug}/chapter/${previousNavChapter.id}`} className="ui-button ui-button-secondary">
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
        {firstChapterLoading && !firstReader ? (
          <div className="mx-auto max-w-3xl space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="surface h-[70vh] animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <div className={`mx-auto space-y-8 ${fitWidth ? "max-w-4xl" : "max-w-none overflow-x-auto"}`}>
            {loadedChapters.map((loadedChapter, chapterIndex) => {
              const chapterReader = loadedChapter.reader;
              const chapterDisplay = chapterReader?.chapter ?? loadedChapter.chapter;
              const chapterSource = chapterDisplay.sourceName ?? "Source";
              const fallbackUrl = chapterReader?.externalUrl || loadedChapter.chapter.url;

              return (
                <section
                  key={loadedChapter.chapter.id}
                  data-reader-chapter-id={loadedChapter.chapter.id}
                  className="scroll-mt-24 [content-visibility:auto] [contain-intrinsic-size:1px_2400px]"
                >
                  {chapterIndex > 0 && (
                    <div className="mx-auto mb-4 flex max-w-3xl items-center gap-3 py-4 text-xs font-bold uppercase text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      Chapter {chapterDisplay.chapterNumber}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  {loadedChapter.isLoading ? (
                    <div className="mx-auto max-w-3xl space-y-4">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <div key={index} className="surface h-[70vh] animate-pulse rounded-lg bg-muted" />
                      ))}
                    </div>
                  ) : chapterReader?.status === "READABLE" ? (
                    <div className="space-y-3">
                      {chapterReader.usedAlternative && (
                        <div className="surface mx-auto max-w-3xl px-4 py-3 text-sm font-semibold text-muted-foreground">
                          The original source could not open in Mangateo, so this reader is using {chapterSource} for the same chapter.
                        </div>
                      )}
                      {chapterReader.pages.map((page) => (
                        <img
                          key={`${loadedChapter.chapter.id}-${page.index}-${page.imageUrl}`}
                          src={page.imageUrl}
                          alt={`Chapter ${chapterDisplay.chapterNumber} page ${page.index + 1}`}
                          className={fitWidth ? "mx-auto h-auto w-full max-w-full rounded-sm bg-card" : "mx-auto h-auto max-w-none rounded-sm bg-card"}
                          loading={chapterIndex === 0 && page.index < 2 ? "eager" : "lazy"}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <h2 className="text-xl font-semibold">This chapter opens on the source</h2>
                      <p className="mt-2 max-w-xl text-muted-foreground">
                        {chapterReader?.reason || "This provider does not expose readable public pages to Mangateo yet."}
                      </p>
                      <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="ui-button ui-button-primary mt-4">
                        <ExternalLink className="h-4 w-4" />
                        Open on {chapterSource}
                      </a>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
