import { prisma } from "@/lib/db";
import { getMangaChapterPage, getChapterMode } from "@/lib/chapters";
import { getCurrentUserId } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

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
    const sourceId = searchParams.get("sourceId") || undefined;
    const cursor = searchParams.get("cursor") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const manga = await prisma.manga.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!manga) {
      return NextResponse.json({ error: "Manga not found" }, { status: 404 });
    }

    const tracked = await prisma.userManga.findUnique({
      where: {
        userId_mangaId: {
          userId,
          mangaId: manga.id,
        },
      },
      select: { lastReadChapterNumber: true },
    });
    if (!tracked) {
      return NextResponse.json({ error: "Manga not tracked" }, { status: 403 });
    }

    if (sourceId) {
      const source = await prisma.source.findFirst({
        where: {
          id: sourceId,
          mangaId: manga.id,
        },
        select: { id: true },
      });
      if (!source) {
        return NextResponse.json({ error: "Source not found" }, { status: 404 });
      }
    }

    const page = await getMangaChapterPage({
      mangaId: manga.id,
      cursor,
      limit,
      sourceId,
      lastReadChapterNumber: tracked.lastReadChapterNumber,
    });

    return NextResponse.json({ ...page, mode });
  } catch (error) {
    console.error("Error fetching chapter page:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
