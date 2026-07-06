import { prisma } from "@/lib/db";
import { getLibraryMangaSummary } from "@/lib/library-summary";
import { getCurrentUserId } from "@/lib/session";
import { filterSourcesForManga } from "@/lib/source-overrides";
import { NextRequest, NextResponse } from "next/server";
import { getMangaAccess, parentalControlError } from "@/lib/parental-controls";

type ProgressAction = "set" | "caught-up" | "next" | "previous";

async function getTrackedManga(slug: string, userId: string) {
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
  if (!manga) return { error: "Manga not found" as const, status: 404 as const };

  const tracked = await prisma.userManga.findUnique({
    where: {
      userId_mangaId: {
        userId,
        mangaId: manga.id,
      },
    },
    select: {
      id: true,
      mangaId: true,
      lastReadChapterNumber: true,
    },
  });
  if (!tracked) return { error: "Manga not tracked" as const, status: 403 as const };

  return { manga, tracked };
}

async function resolveProgressChapterNumber({
  action,
  mangaId,
  sourceIds,
  currentProgress,
  chapterNumber,
  readableOnly = false,
}: {
  action: ProgressAction;
  mangaId: string;
  sourceIds?: string[];
  currentProgress: number | null;
  chapterNumber?: unknown;
  readableOnly?: boolean;
}) {
  const sourceFilter = { ...(sourceIds ? { sourceId: { in: sourceIds } } : {}), ...(readableOnly ? { readerStatus: "READABLE" } : {}) };

  if (action === "set") {
    if (typeof chapterNumber !== "number" || !Number.isFinite(chapterNumber)) {
      return { error: "chapterNumber is required for set action", status: 400 as const };
    }
    const chapter = await prisma.chapter.findFirst({
      where: { mangaId, chapterNumber, ...sourceFilter },
      select: { chapterNumber: true },
    });
    if (!chapter) return { error: "Chapter not found", status: 404 as const };
    return { chapterNumber: chapter.chapterNumber };
  }

  if (action === "caught-up") {
    const latest = await prisma.chapter.aggregate({
      where: { mangaId, ...sourceFilter },
      _max: { chapterNumber: true },
    });
    return { chapterNumber: latest._max.chapterNumber ?? null };
  }

  if (action === "next") {
    const next = await prisma.chapter.findFirst({
      where: {
        mangaId,
        ...sourceFilter,
        ...(currentProgress == null ? {} : { chapterNumber: { gt: currentProgress } }),
      },
      orderBy: { chapterNumber: "asc" },
      select: { chapterNumber: true },
    });
    return { chapterNumber: next?.chapterNumber ?? currentProgress };
  }

  if (action === "previous") {
    if (typeof chapterNumber !== "number" || !Number.isFinite(chapterNumber)) {
      return { error: "chapterNumber is required for previous action", status: 400 as const };
    }
    const previous = await prisma.chapter.findFirst({
      where: {
        mangaId,
        ...sourceFilter,
        chapterNumber: { lt: chapterNumber },
      },
      orderBy: { chapterNumber: "desc" },
      select: { chapterNumber: true },
    });
    return { chapterNumber: previous?.chapterNumber ?? null };
  }

  return { error: "Unsupported progress action", status: 400 as const };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();
    const action = body?.action as ProgressAction;
    if (!["set", "caught-up", "next", "previous"].includes(action)) {
      return NextResponse.json({ error: "Unsupported progress action" }, { status: 400 });
    }

    const result = await getTrackedManga(slug, userId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const access = await getMangaAccess(userId, result.manga.id);
    if (!access.allowed) return parentalControlError(access.reason);

    const mangaSources = result.manga.sources ?? [];
    const progress = await resolveProgressChapterNumber({
      action,
      mangaId: result.manga.id,
      sourceIds: mangaSources.length > 0
        ? filterSourcesForManga(result.manga, mangaSources).map((source) => source.id)
        : undefined,
      currentProgress: result.tracked.lastReadChapterNumber,
      chapterNumber: body?.chapterNumber,
      readableOnly: access.isChild,
    });
    if ("error" in progress) {
      return NextResponse.json({ error: progress.error }, { status: progress.status });
    }

    const updated = await prisma.userManga.update({
      where: {
        userId_mangaId: {
          userId,
          mangaId: result.manga.id,
        },
      },
      data: {
        lastReadChapterNumber: progress.chapterNumber,
        lastReadAt: progress.chapterNumber == null ? null : new Date(),
      },
      select: {
        lastReadChapterNumber: true,
        lastReadAt: true,
      },
    });

    const summary = await getLibraryMangaSummary(userId, result.manga.id, access.isChild);

    return NextResponse.json({
      lastReadChapterNumber: updated.lastReadChapterNumber,
      lastReadAt: updated.lastReadAt,
      summary,
    });
  } catch (error) {
    console.error("Failed to update manga progress:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
