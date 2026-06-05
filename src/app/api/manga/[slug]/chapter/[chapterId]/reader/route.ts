import { prisma } from "@/lib/db";
import { isExternalReaderSource } from "@/lib/external-reader-sources";
import { fetchReaderPages } from "@/lib/scrapers/registry";
import { getCurrentUserId } from "@/lib/session";
import type { ReaderResult } from "@/lib/scrapers/types";
import { NextResponse } from "next/server";

const READER_SOURCE_PRIORITY = [
  "Witch Hat Atelier Manga",
  "MangaDex",
  "Urek Mazino",
  "Bleach Live",
  "Manganato",
  "NeloManga",
];

type ReaderChapter = {
  id: string;
  providerChapterId: string | null;
  chapterNumber: number;
  title: string | null;
  url: string;
  source: {
    id: string;
    sourceName: string;
    sourceUrl: string;
  } | null;
};

function sourceRank(sourceName?: string | null) {
  const index = READER_SOURCE_PRIORITY.indexOf(sourceName ?? "");
  return index === -1 ? READER_SOURCE_PRIORITY.length : index;
}

async function readChapter(chapter: ReaderChapter): Promise<ReaderResult> {
  if (!chapter.source) {
    return {
      status: "UNSUPPORTED",
      pages: [],
      externalUrl: chapter.url,
      reason: "This chapter has no source provider.",
    };
  }

  return fetchReaderPages({
    id: chapter.id,
    providerChapterId: chapter.providerChapterId,
    url: chapter.url,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
  }, chapter.source);
}

async function persistReaderMetadata(chapterId: string, result: ReaderResult) {
  await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      readerStatus: result.status,
      readerCheckedAt: new Date(),
      readerPageCount: result.pages.length,
      readerError: result.status === "READABLE" ? null : result.reason ?? null,
    },
  });
}

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

    let result = await readChapter(chapter);
    await persistReaderMetadata(chapter.id, result);
    let activeChapter = chapter;
    let usedAlternative = false;

    if (result.status !== "READABLE" && !isExternalReaderSource(chapter.source?.sourceName)) {
      const alternatives = await prisma.chapter.findMany({
        where: {
          mangaId: manga.id,
          chapterNumber: chapter.chapterNumber,
          id: { not: chapter.id },
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

      alternatives.sort((a, b) => sourceRank(a.source?.sourceName) - sourceRank(b.source?.sourceName));

      for (const alternative of alternatives) {
        const alternativeResult = await readChapter(alternative);
        await persistReaderMetadata(alternative.id, alternativeResult);
        if (alternativeResult.status === "READABLE") {
          result = alternativeResult;
          activeChapter = alternative;
          usedAlternative = true;
          break;
        }
      }
    }

    return NextResponse.json({
      ...result,
      usedAlternative,
      chapter: {
        id: activeChapter.id,
        chapterNumber: activeChapter.chapterNumber,
        title: activeChapter.title,
        sourceName: activeChapter.source?.sourceName ?? null,
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
