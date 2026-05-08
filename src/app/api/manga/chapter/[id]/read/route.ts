import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const { id } = await params;
        const { isRead } = await request.json();

        const chapter = await prisma.chapter.findUnique({
            where: { id },
            select: { id: true, mangaId: true },
        });
        if (!chapter) {
            return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
        }

        const tracked = await prisma.userManga.findUnique({
            where: {
                    userId_mangaId: {
                    userId,
                    mangaId: chapter.mangaId,
                },
            },
        });
        if (!tracked) {
            return NextResponse.json({ error: "Manga not tracked" }, { status: 403 });
        }

        const userChapter = await prisma.userChapter.upsert({
            where: {
                userId_chapterId: {
                    userId,
                    chapterId: chapter.id,
                },
            },
            update: {
                isRead: !!isRead,
                readAt: isRead ? new Date() : null,
            },
            create: {
                userId,
                chapterId: chapter.id,
                isRead: !!isRead,
                readAt: isRead ? new Date() : null,
            },
        });

        return NextResponse.json(userChapter);
    } catch (error) {
        console.error("Failed to update chapter status:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
