import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { getMangaAccess, parentalControlError } from "@/lib/parental-controls";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LIMIT = 1;
const MAX_LIMIT = 3;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; chapterId: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug, chapterId } = await params;
    const limitParam = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const manga = await prisma.manga.findUnique({
      where: { slug },
      select: { id: true },
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
      select: { id: true },
    });
    if (!tracked) {
      return NextResponse.json({ error: "Manga not tracked" }, { status: 403 });
    }

    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        mangaId: manga.id,
      },
      select: {
        chapterNumber: true,
        sourceId: true,
      },
    });
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const chapters = await prisma.chapter.findMany({
      where: {
        mangaId: manga.id,
        ...(chapter.sourceId ? { sourceId: chapter.sourceId } : {}),
        chapterNumber: { gt: chapter.chapterNumber },
      },
      orderBy: [
        { chapterNumber: "asc" },
        { releaseDate: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      take: limit + 1,
      select: {
        id: true,
        chapterNumber: true,
        title: true,
        url: true,
        source: {
          select: {
            sourceName: true,
          },
        },
      },
    });

    const visibleChapters = chapters.slice(0, limit);
    return NextResponse.json({
      chapters: visibleChapters.map((nextChapter) => ({
        id: nextChapter.id,
        chapterNumber: nextChapter.chapterNumber,
        title: nextChapter.title,
        url: nextChapter.url,
        sourceName: nextChapter.source?.sourceName ?? null,
      })),
      hasMore: chapters.length > limit,
    });
  } catch (error) {
    console.error("Error fetching next reader chapters:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
