import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug } = await params;
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
      return NextResponse.json({ error: "Manga not tracked" }, { status: 404 });
    }

    await prisma.userManga.delete({
      where: {
        userId_mangaId: {
          userId,
          mangaId: manga.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove manga from library:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
