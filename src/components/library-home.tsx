"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { LibraryDashboard } from "@/components/library-dashboard";
import type { MangaCardData } from "@/components/manga-card";

function LibrarySkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading library">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="surface min-h-[188px] animate-pulse rounded-lg p-6">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="mt-5 h-8 w-56 rounded bg-muted" />
          <div className="mt-4 h-4 w-72 max-w-full rounded bg-muted" />
          <div className="mt-6 flex gap-2">
            <div className="h-10 w-32 rounded bg-muted" />
            <div className="h-10 w-28 rounded bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface h-24 animate-pulse rounded-lg p-4">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="mt-4 h-8 w-10 rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="h-7 w-28 rounded bg-muted" />
            <div className="mt-2 h-4 w-64 max-w-full rounded bg-muted" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-9 w-24 rounded bg-muted" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="surface h-36 animate-pulse rounded-lg sm:h-80">
              <div className="h-full bg-muted/70 sm:h-56" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LibraryHome() {
  const [mangas, setMangas] = useState<MangaCardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isTopRefreshing, setIsTopRefreshing] = useState(false);
  const isLoadingRef = useRef(false);
  const pullStartYRef = useRef<number | null>(null);
  const isPullRefreshActiveRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const wheelResetTimerRef = useRef<number | null>(null);
  const wheelRefreshTimerRef = useRef<number | null>(null);

  const loadLibrary = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      setError(null);
      const res = await fetch("/api/manga/library", { cache: "no-store" });
      if (!res.ok) throw new Error(`Library load failed: ${res.status}`);
      const body = await res.json();
      setMangas(body.mangas ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError("Could not load your library.");
      setMangas([]);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLibrary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLibrary]);

  useEffect(() => {
    const handleLibraryRefresh = () => {
      void loadLibrary();
    };
    window.addEventListener("mangateo:library-refresh", handleLibraryRefresh);
    return () => window.removeEventListener("mangateo:library-refresh", handleLibraryRefresh);
  }, [loadLibrary]);

  useEffect(() => {
    const pullThreshold = 86;
    const maxPullDistance = 118;

    const startedOnIgnoredElement = (target: EventTarget | null) => (
      target instanceof Element
      && Boolean(target.closest("a, button, input, textarea, select, [role='button'], .dialog-overlay, .dialog-panel, .custom-scrollbar"))
    );

    const clearWheelTimers = () => {
      if (wheelResetTimerRef.current !== null) {
        window.clearTimeout(wheelResetTimerRef.current);
        wheelResetTimerRef.current = null;
      }

      if (wheelRefreshTimerRef.current !== null) {
        window.clearTimeout(wheelRefreshTimerRef.current);
        wheelRefreshTimerRef.current = null;
      }
    };

    const resetPull = () => {
      clearWheelTimers();
      pullStartYRef.current = null;
      isPullRefreshActiveRef.current = false;
      pullDistanceRef.current = 0;
      setIsPulling(false);
      setPullDistance(0);
    };

    const refreshFromPull = async () => {
      setIsPulling(false);
      setPullDistance(pullThreshold);
      setIsTopRefreshing(true);
      await loadLibrary();
      setIsTopRefreshing(false);
      resetPull();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (startedOnIgnoredElement(event.target)) return;
      if (window.scrollY > 0 || isLoadingRef.current) return;
      pullStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (pullStartYRef.current === null || event.touches.length !== 1) return;

      const rawDistance = event.touches[0].clientY - pullStartYRef.current;
      if (rawDistance <= 0) {
        resetPull();
        return;
      }

      if (window.scrollY > 0 && !isPullRefreshActiveRef.current) return;

      event.preventDefault();
      isPullRefreshActiveRef.current = true;

      const easedDistance = Math.min(maxPullDistance, Math.round(rawDistance * 0.58));
      pullDistanceRef.current = easedDistance;
      setIsPulling(true);
      setPullDistance(easedDistance);
    };

    const handleTouchEnd = () => {
      if (!isPullRefreshActiveRef.current) {
        resetPull();
        return;
      }

      if (pullDistanceRef.current >= pullThreshold) {
        void refreshFromPull();
      } else {
        resetPull();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if (startedOnIgnoredElement(event.target)) return;
      if (window.scrollY > 0 || isLoadingRef.current) return;
      pullStartYRef.current = event.clientY;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || pullStartYRef.current === null) return;

      const rawDistance = event.clientY - pullStartYRef.current;
      if (rawDistance <= 0) {
        resetPull();
        return;
      }

      event.preventDefault();
      isPullRefreshActiveRef.current = true;

      const easedDistance = Math.min(maxPullDistance, Math.round(rawDistance * 0.58));
      pullDistanceRef.current = easedDistance;
      setIsPulling(true);
      setPullDistance(easedDistance);
    };

    const handleWheel = (event: WheelEvent) => {
      if (startedOnIgnoredElement(event.target)) return;

      if (event.deltaY >= 0) {
        if (isPullRefreshActiveRef.current) resetPull();
        return;
      }

      if (window.scrollY > 0 || isLoadingRef.current) return;

      event.preventDefault();
      isPullRefreshActiveRef.current = true;

      const nextDistance = Math.min(maxPullDistance, pullDistanceRef.current + Math.abs(event.deltaY) * 0.42);
      pullDistanceRef.current = nextDistance;
      setIsPulling(true);
      setPullDistance(Math.round(nextDistance));

      if (nextDistance >= pullThreshold) {
        if (wheelRefreshTimerRef.current === null) {
          wheelRefreshTimerRef.current = window.setTimeout(() => {
            wheelRefreshTimerRef.current = null;
            void refreshFromPull();
          }, 160);
        }
        return;
      }

      if (wheelResetTimerRef.current !== null) {
        window.clearTimeout(wheelResetTimerRef.current);
      }
      wheelResetTimerRef.current = window.setTimeout(resetPull, 420);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", resetPull);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handleTouchEnd);
    window.addEventListener("pointercancel", resetPull);
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", resetPull);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleTouchEnd);
      window.removeEventListener("pointercancel", resetPull);
      window.removeEventListener("wheel", handleWheel);
      clearWheelTimers();
    };
  }, [loadLibrary]);

  useEffect(() => {
    if (!mangas?.some((manga) => manga.syncStatus === "SYNCING")) return;
    const timer = window.setTimeout(() => {
      void loadLibrary();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [loadLibrary, mangas]);

  const pullRefreshIndicator = (
    <PullRefreshIndicator
      isActive={isPulling || isTopRefreshing}
      isRefreshing={isTopRefreshing}
      distance={pullDistance}
    />
  );

  if (mangas === null) {
    return (
      <>
        {pullRefreshIndicator}
        <LibrarySkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        {pullRefreshIndicator}
        <div className="empty-state">
          <h2 className="text-xl font-semibold">Library unavailable</h2>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <button type="button" onClick={() => void loadLibrary()} className="ui-button ui-button-secondary mt-5">
            Try again
          </button>
        </div>
      </>
    );
  }

  if (mangas.length === 0) {
    return (
      <>
        {pullRefreshIndicator}
        <div className="empty-state">
          <h2 className="text-xl font-semibold">No manga tracked yet</h2>
          <p className="mt-2 text-muted-foreground">Add your first manga to start tracking releases.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {pullRefreshIndicator}
      <LibraryDashboard key={mangas.map((manga) => `${manga.id}:${manga.syncStatus}:${manga.lastReadChapterNumber}`).join("|")} mangas={mangas} />
    </>
  );
}

function PullRefreshIndicator({
  isActive,
  isRefreshing,
  distance,
}: {
  isActive: boolean;
  isRefreshing: boolean;
  distance: number;
}) {
  const progress = Math.min(1, distance / 86);

  return (
    <div
      aria-hidden={!isActive}
      aria-label={isRefreshing ? "Refreshing library" : "Pull to refresh library"}
      className="pointer-events-none fixed left-1/2 top-0 z-[70] -translate-x-1/2 transition-[opacity,transform] duration-200"
      style={{
        opacity: isActive ? 1 : 0,
        transform: `translate(-50%, ${isRefreshing ? 72 : Math.max(0, distance - 34)}px) scale(${0.82 + progress * 0.18})`,
      }}
    >
      <div className="pull-refresh-surface flex h-11 w-11 items-center justify-center rounded-full">
        <Loader2
          className={`h-5 w-5 ${isRefreshing || progress >= 1 ? "animate-spin text-primary" : "text-muted-foreground"}`}
          style={{ transform: isRefreshing ? undefined : `rotate(${progress * 210}deg)` }}
        />
      </div>
    </div>
  );
}
