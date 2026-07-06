import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { getMangaAccess, parentalControlError } from "@/lib/parental-controls";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; sourceId: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug, sourceId } = await params;
    const body = await request.json();
    const disabled = body?.disabled;

    if (typeof disabled !== "boolean") {
      return NextResponse.json({ error: "Missing required field: disabled" }, { status: 400 });
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

    if (disabled) {
      await prisma.userMangaDisabledSource.upsert({
        where: {
          userMangaId_sourceId: {
            userMangaId: tracked.id,
            sourceId,
          },
        },
        update: {},
        create: {
          userMangaId: tracked.id,
          sourceId,
        },
      });
    } else {
      await prisma.userMangaDisabledSource.deleteMany({
        where: {
          userMangaId: tracked.id,
          sourceId,
        },
      });
    }

    return NextResponse.json({ sourceId, disabled });
  } catch (error) {
    console.error("Error updating manga source setting:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
