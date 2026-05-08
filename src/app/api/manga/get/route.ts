import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";

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

        const tracked = await prisma.userManga.findUnique({
            where: {
                userId_mangaId: {
                    userId,
                    mangaId: manga.id,
                },
            },
        });
        if (!tracked) {
            return NextResponse.json({ error: "Manga not tracked" }, { status: 403 });
        }

        const userChapters = await prisma.userChapter.findMany({
            where: {
                userId,
                chapterId: { in: manga.chapters.map((chapter) => chapter.id) },
            },
        });
        const readByChapterId = new Map(userChapters.map((entry) => [entry.chapterId, entry.isRead]));

        return NextResponse.json({
            ...manga,
            chapters: manga.chapters.map((chapter) => ({
                ...chapter,
                isRead: readByChapterId.get(chapter.id) ?? false,
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
