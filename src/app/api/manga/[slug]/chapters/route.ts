import { prisma } from "@/lib/db";
import { getMangaChapterPage, getChapterMode, getChapterSortDirection, getMangaChapterTarget } from "@/lib/chapters";
import { getCurrentUserId } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { filterSourcesForManga } from "@/lib/source-overrides";
import { getSourceRankMap } from "@/lib/source-ranking";
import { getMangaAccess, parentalControlError } from "@/lib/parental-controls";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const mode = getChapterMode(searchParams.get("mode"));
    const sortDirection = getChapterSortDirection(searchParams.get("sort"));
    const target = searchParams.get("target");
    const sourceId = searchParams.get("sourceId") || undefined;
    const cursor = searchParams.get("cursor") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const manga = await prisma.manga.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        sources: {
          select: {
            id: true,
            sourceName: true,
            sourceUrl: true,
          },
        },
      },
    });
    if (!manga) {
      return NextResponse.json({ error: "Manga not found" }, { status: 404 });
    }
    const access = await getMangaAccess(userId, manga.id);
    if (!access.allowed) return parentalControlError(access.reason);

    const tracked = await prisma.userManga.findUnique({
      where: {
        userId_mangaId: {
          userId,
          mangaId: manga.id,
        },
      },
      select: {
        lastReadChapterNumber: true,
        disabledSources: {
          select: { sourceId: true },
        },
        sourcePreferences: {
          select: {
            sourceId: true,
            position: true,
          },
        },
      },
    });
    if (!tracked) {
      return NextResponse.json({ error: "Manga not tracked" }, { status: 403 });
    }

    const mangaSources = manga.sources ?? [];
    const visibleSources = filterSourcesForManga(manga, mangaSources);
    const disabledSourceIds = new Set((tracked.disabledSources ?? []).map((source) => source.sourceId));
    const sourcePositionById = new Map(
      (tracked.sourcePreferences ?? []).map((source) => [source.sourceId, source.position]),
    );
    const enabledSources = visibleSources
      .filter((source) => !disabledSourceIds.has(source.id))
      .map((source) => ({
        ...source,
        position: sourcePositionById.get(source.id) ?? null,
      }));
    const visibleSourceIds = new Set(enabledSources.map((source) => source.id));
    const sourceIds = mangaSources.length > 0 ? [...visibleSourceIds] : undefined;
    const sourceRanks = getSourceRankMap(enabledSources, manga.slug);

    if (sourceId && !visibleSourceIds.has(sourceId)) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    if (target === "first" || target === "latest" || target === "next-unread") {
      const chapter = await getMangaChapterTarget({
        mangaId: manga.id,
        mangaSlug: manga.slug,
        sourceId,
        sourceIds: sourceId ? undefined : sourceIds,
        sourceRanks,
        lastReadChapterNumber: tracked.lastReadChapterNumber,
        target,
        readableOnly: access.isChild,
      });

      const safeChapter = access.isChild && chapter ? { ...chapter, url: `/manga/${manga.slug}/chapter/${chapter.id}`, sourceName: undefined, sourceId: null } : chapter;
      return NextResponse.json({ chapter: safeChapter, mode, sortDirection });
    }

    const page = await getMangaChapterPage({
      mangaId: manga.id,
      cursor,
      limit,
      sourceId,
      sourceIds: sourceId ? undefined : sourceIds,
      lastReadChapterNumber: tracked.lastReadChapterNumber,
      sortDirection,
      readableOnly: access.isChild,
    });

    const safePage = access.isChild ? { ...page, chapters: page.chapters.map((chapter) => ({ ...chapter, url: `/manga/${manga.slug}/chapter/${chapter.id}`, sourceName: undefined, sourceId: null })) } : page;
    return NextResponse.json({ ...safePage, mode, sortDirection });
  } catch (error) {
    console.error("Error fetching chapter page:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
