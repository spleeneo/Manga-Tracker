"use client";

import { useEffect, useState } from "react";
import type { ExploreDisplayManga } from "@/lib/explore/ui-results";
import type { MangaPillSynopsis } from "@/lib/explore/mangapill-metadata";

export function useMangaPillSynopsis(preview: ExploreDisplayManga | null) {
  const [synopses, setSynopses] = useState<Record<string, MangaPillSynopsis>>({});
  const [failure, setFailure] = useState<{ url: string; attempt: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const url = !preview?.description ? preview?.sources.find(source => source.name === "MangaPill")?.url : undefined;

  useEffect(() => {
    if (!url || synopses[url] || (failure?.url === url && failure.attempt === attempt)) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/explore/mangapill/metadata?url=${encodeURIComponent(url)}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Synopsis unavailable");
        const data: MangaPillSynopsis = await res.json();
        if (!controller.signal.aborted) setSynopses(current => ({ ...current, [url]: data }));
      } catch {
        if (!controller.signal.aborted) setFailure({ url, attempt });
      }
    })();
    return () => controller.abort();
  }, [url, attempt, synopses, failure]);

  const enrich = (manga: ExploreDisplayManga) => {
    if (manga.description) return manga;
    const synopsis = manga.sources.map(source => synopses[source.url]).find(value => value?.description);
    return synopsis?.description ? { ...manga, description: synopsis.description } : manga;
  };
  const status = !url || synopses[url] ? "ready" : failure?.url === url && failure.attempt === attempt ? "error" : "loading";
  return { enrich, status, retry: () => setAttempt(current => current + 1) };
}
