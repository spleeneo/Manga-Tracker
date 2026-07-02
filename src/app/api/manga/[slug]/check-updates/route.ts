import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getMangaAccess, parentalControlError } from "@/lib/parental-controls";
import { after } from "next/server";
import { enqueueMangaSyncJob, processSyncJob } from "@/lib/sync-jobs";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const { slug } = await params;

        const manga = await prisma.manga.findUnique({
            where: { slug }
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
        });
        if (!tracked) {
            return NextResponse.json({ error: "Manga not tracked" }, { status: 403 });
        }

        const job = await enqueueMangaSyncJob(userId, manga.id);

        after(async () => {
            try {
                await processSyncJob(job.id);
            } catch (error) {
                console.error("Manual manga update job failed:", error);
            }
        });

        return NextResponse.json({ success: true, queued: 1, jobId: job.id });
    } catch (error) {
        console.error("Manual update failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
