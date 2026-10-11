import { NextRequest, NextResponse } from "next/server";
import { searchScrapersDetailed } from "@/lib/scrapers/registry";
import { prisma } from "@/lib/db";
import { decorateSearchLibrary } from "@/lib/search-library";
import { getCurrentUserId } from "@/lib/session";
import { getChildPolicy } from "@/lib/parental-controls";
import { getExploreManga } from "@/lib/explore/mangadex";
import { childCatalogCoverUrl, createChildCatalogSource } from "@/lib/child-safety";

const SEARCH_CACHE_TTL_MS = 60_000;
const searchCache = new Map<string, { expiresAt: number; results: Awaited<ReturnType<typeof searchScrapersDetailed>>["results"] }>();

export async function GET(request: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    if (!query) {
        return NextResponse.json({ results: [] });
    }

    try {
        if (await getChildPolicy(userId)) {
            const { results } = await getExploreManga(userId, { q: query, limit: "24", sort: "trending" });
            return NextResponse.json({ results: results.map((manga) => ({
                title: manga.title,
                description: manga.description,
                coverUrl: childCatalogCoverUrl(manga.id, manga.coverUrl),
                status: manga.status,
                contentRating: manga.contentRating,
                classificationSource: undefined,
                tags: manga.tags,
                isTracked: manga.isTracked,
                librarySlug: manga.librarySlug,
                sources: [createChildCatalogSource(manga.id)],
            })) });
        }

        const cacheKey = query.toLowerCase();
        const cached = searchParams.has("retry") ? undefined : searchCache.get(cacheKey);
        const outcome = cached && cached.expiresAt > Date.now()
            ? { results: cached.results, failedProviders: [], allFailed: false }
            : await searchScrapersDetailed(query);
        if (outcome.allFailed) return NextResponse.json({ error: "Search providers are unavailable. Please retry.", failedProviders: outcome.failedProviders }, { status: 503 });
        if (!outcome.failedProviders.length) searchCache.set(cacheKey, {
            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
            results: outcome.results,
        });
        if (searchCache.size > 100) searchCache.delete(searchCache.keys().next().value!);
        const library = await prisma.userManga.findMany({ where: { userId }, select: { manga: { select: { slug: true, sources: { select: { sourceUrl: true } } } } } });

        return NextResponse.json({ results: decorateSearchLibrary(outcome.results, library), failedProviders: outcome.failedProviders });
    } catch (error) {
        console.error("Search API error:", error);
        return NextResponse.json({ error: "Failed to search" }, { status: 500 });
    }
}
