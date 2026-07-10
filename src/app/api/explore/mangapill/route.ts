import { NextRequest, NextResponse } from "next/server";
import { getMangaPillExploreManga } from "@/lib/explore/mangapill";
import { getChildPolicy } from "@/lib/parental-controls";
import { getCurrentUserId } from "@/lib/session";
import { getExploreManga } from "@/lib/explore/mangadex";
import { childCatalogCoverUrl, createChildCatalogSource } from "@/lib/child-safety";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const params = request.nextUrl.searchParams;

    if (await getChildPolicy(userId)) {
      const data = await getExploreManga(userId, {
        sort: "trending",
        limit: params.get("limit"),
        offset: params.get("offset"),
      });
      return NextResponse.json({
        ...data,
        results: data.results.map((manga) => ({
          ...manga,
          coverUrl: childCatalogCoverUrl(manga.id, manga.coverUrl),
          classificationSource: undefined,
          source: createChildCatalogSource(manga.id),
        })),
      });
    }

    return NextResponse.json(await getMangaPillExploreManga(userId, {
      sort: params.get("sort"),
      genre: params.get("genre"),
      type: params.get("type"),
      status: params.get("status"),
      limit: params.get("limit"),
      offset: params.get("offset"),
    }));
  } catch (error) {
    console.error("MangaPill explore API error:", error);
    return NextResponse.json({ error: "Failed to load MangaPill explore results" }, { status: 502 });
  }
}
