import { NextRequest, NextResponse } from "next/server";
import { searchScrapers } from "@/lib/scrapers/registry";
import { getCurrentUserId } from "@/lib/session";
import { getChildPolicy } from "@/lib/parental-controls";

const SEARCH_CACHE_TTL_MS = 60_000;
const searchCache = new Map<string, { expiresAt: number; results: Awaited<ReturnType<typeof searchScrapers>> }>();

export async function GET(request: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (await getChildPolicy(userId)) return NextResponse.json({ results: [] });
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    if (!query) {
        return NextResponse.json({ results: [] });
    }

    try {
        const cacheKey = query.toLowerCase();
        const cached = searchCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return NextResponse.json({ results: cached.results });
        }

        const results = await searchScrapers(query);
        searchCache.set(cacheKey, {
            expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
            results,
        });

        return NextResponse.json({ results });
    } catch (error) {
        console.error("Search API error:", error);
        return NextResponse.json({ error: "Failed to search" }, { status: 500 });
    }
}
