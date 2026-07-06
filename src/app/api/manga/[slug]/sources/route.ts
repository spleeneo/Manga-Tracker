import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { getMangaAccess, parentalControlError } from "@/lib/parental-controls";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
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
    const sourceIds = body?.sourceIds;

    if (!Array.isArray(sourceIds) || sourceIds.some((sourceId) => typeof sourceId !== "string")) {
      return NextResponse.json({ error: "sourceIds must be an array of source ids" }, { status: 400 });
    }

    const uniqueSourceIds = [...new Set(sourceIds)];
    if (uniqueSourceIds.length !== sourceIds.length) {
      return NextResponse.json({ error: "sourceIds must not contain duplicates" }, { status: 400 });
    }

    const manga = await prisma.manga.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!manga) {
      return NextResponse.json({ error: "Manga not found" }, { status: 404 });
    }
    const access = await getMangaAccess(userId, manga.id);
    if (!access.allowed) return parentalControlError(access.reason);
    if (access.isChild) return NextResponse.json({ error: "Source management unavailable" }, { status: 404 });

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

    const sources = await prisma.source.findMany({
      where: {
        mangaId: manga.id,
        id: { in: uniqueSourceIds },
      },
      select: { id: true },
    });
    if (sources.length !== uniqueSourceIds.length) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.userMangaSourcePreference.deleteMany({
        where: {
          userMangaId: tracked.id,
          sourceId: { notIn: uniqueSourceIds },
        },
      }),
      ...uniqueSourceIds.map((sourceId, position) => prisma.userMangaSourcePreference.upsert({
        where: {
          userMangaId_sourceId: {
            userMangaId: tracked.id,
            sourceId,
          },
        },
        update: { position },
        create: {
          userMangaId: tracked.id,
          sourceId,
          position,
        },
      })),
    ]);

    return NextResponse.json({
      sources: uniqueSourceIds.map((sourceId, position) => ({ sourceId, position })),
    });
  } catch (error) {
    console.error("Error updating manga source order:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
