import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getMangaAccess, parentalControlError } from "@/lib/parental-controls";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        const { slug } = await params;

        const manga = await prisma.manga.findUnique({
            where: { slug },
            include: {
                sources: true,
                chapters: {
                    orderBy: { chapterNumber: 'desc' },
                }
            }
        });

        if (!manga) {
            return NextResponse.json({ error: "Manga not found" }, { status: 404 });
        }
        const tracked = await prisma.userManga.findUnique({ where: { userId_mangaId: { userId, mangaId: manga.id } }, select: { id: true } });
        if (!tracked) return NextResponse.json({ error: "Manga not tracked" }, { status: 403 });
        const access = await getMangaAccess(userId, manga.id);
        if (!access.allowed) return parentalControlError(access.reason);

        if (access.isChild) return NextResponse.json({
            ...manga,
            sources: [],
            chapters: manga.chapters.filter((chapter) => chapter.readerStatus === "READABLE").map((chapter) => ({ ...chapter, url: `/manga/${manga.slug}/chapter/${chapter.id}`, sourceId: null, providerChapterId: null })),
        });
        return NextResponse.json(manga);
    } catch (error) {
        console.error("Error fetching manga:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
