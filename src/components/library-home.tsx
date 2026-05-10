"use client";

import { useCallback, useEffect, useState } from "react";
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

  const loadLibrary = useCallback(async () => {
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
    if (!mangas?.some((manga) => manga.syncStatus === "SYNCING")) return;
    const timer = window.setTimeout(() => {
      void loadLibrary();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [loadLibrary, mangas]);

  if (mangas === null) {
    return <LibrarySkeleton />;
  }

  if (error) {
    return (
      <div className="empty-state">
        <h2 className="text-xl font-semibold">Library unavailable</h2>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <button type="button" onClick={() => void loadLibrary()} className="ui-button ui-button-secondary mt-5">
          Try again
        </button>
      </div>
    );
  }

  if (mangas.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="text-xl font-semibold">No manga tracked yet</h2>
        <p className="mt-2 text-muted-foreground">Add your first manga to start tracking releases.</p>
      </div>
    );
  }

  return <LibraryDashboard key={mangas.map((manga) => `${manga.id}:${manga.syncStatus}:${manga.lastReadChapterNumber}`).join("|")} mangas={mangas} />;
}
