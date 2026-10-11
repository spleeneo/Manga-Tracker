import type { AggregatedSearchResult } from "@/lib/scrapers/types";

export function sourceIdentity(url: string) {
    try {
        const parsed = new URL(url);
        const mangaDexId = parsed.hostname === "mangadex.org" ? parsed.pathname.match(/^\/title\/([^/]+)/)?.[1] : null;
        return mangaDexId ? `mangadex:${mangaDexId}` : `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
    } catch { return url; }
}

export function decorateSearchLibrary(results: AggregatedSearchResult[], library: Array<{ manga: { slug: string; sources: Array<{ sourceUrl: string }> } }>) {
    const slugs = new Map(library.flatMap(({ manga }) => manga.sources.map((source) => [sourceIdentity(source.sourceUrl), manga.slug] as const)));
    return results.map((result) => {
        const librarySlug = result.sources.map((source) => slugs.get(sourceIdentity(source.url))).find(Boolean);
        return { ...result, isTracked: Boolean(librarySlug), librarySlug };
    });
}
