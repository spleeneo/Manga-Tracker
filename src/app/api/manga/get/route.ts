import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getMangaAccess, parentalControlError } from "@/lib/parental-controls";

export async function GET(request: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get("slug");

    if (!slug) {
        return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    try {
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
        const access = await getMangaAccess(userId, manga.id);
        if (!access.allowed) return parentalControlError(access.reason);

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

        return NextResponse.json({
            ...manga,
            sources: access.isChild ? [] : manga.sources,
            chapters: manga.chapters.filter((chapter) => !access.isChild || chapter.readerStatus === "READABLE").map((chapter) => ({
                ...chapter,
                ...(access.isChild ? { url: `/manga/${manga.slug}/chapter/${chapter.id}`, sourceId: null, providerChapterId: null } : {}),
                isRead: tracked.lastReadChapterNumber != null && chapter.chapterNumber <= tracked.lastReadChapterNumber,
            })),
        });
    } catch (error) {
        console.error("Error fetching manga:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
