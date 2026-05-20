import { prisma } from "@/lib/db";
import { fetchReaderPages } from "@/lib/scrapers/registry";
import { getCurrentUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; chapterId: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug, chapterId } = await params;
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
        id: true,
        providerChapterId: true,
        chapterNumber: true,
        title: true,
        url: true,
        source: {
          select: {
            id: true,
            sourceName: true,
            sourceUrl: true,
          },
        },
      },
    });
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const result = chapter.source
      ? await fetchReaderPages({
        id: chapter.id,
        providerChapterId: chapter.providerChapterId,
        url: chapter.url,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
      }, chapter.source)
      : {
        status: "UNSUPPORTED" as const,
        pages: [],
        externalUrl: chapter.url,
        reason: "This chapter has no source provider.",
      };

    await prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        readerStatus: result.status,
        readerCheckedAt: new Date(),
        readerPageCount: result.pages.length,
        readerError: result.status === "READABLE" ? null : result.reason ?? null,
      },
    });

    return NextResponse.json({
      ...result,
      chapter: {
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        sourceName: chapter.source?.sourceName ?? null,
      },
    });
  } catch (error) {
    console.error("Reader API failed:", error);
    return NextResponse.json({
      status: "ERROR",
      pages: [],
      externalUrl: null,
      reason: "The reader could not load this chapter.",
    }, { status: 500 });
  }
}
