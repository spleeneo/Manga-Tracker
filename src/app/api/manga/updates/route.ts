import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { enqueueMangaSyncJob, processSyncJob } from "@/lib/sync-jobs";
import { after } from "next/server";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const library = await prisma.userManga.findMany({
            where: { userId },
            select: {
                mangaId: true,
                manga: {
                    select: {
                        title: true,
                    },
                },
            },
        });

        const jobs: Array<{ id: string }> = [];
        for (const entry of library) {
            jobs.push(await enqueueMangaSyncJob(userId, entry.mangaId));
        }

        after(async () => {
            for (const job of jobs) {
                try {
                    await processSyncJob(job.id);
                } catch (error) {
                    console.error("Library update job failed:", error);
                }
            }
        });

        return NextResponse.json({ success: true, queued: library.length });
    } catch (error) {
        console.error("Library update failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
