import { checkForUpdates } from "@/lib/manga-updater";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
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

        for (const entry of library) {
            await prisma.userManga.update({
                where: {
                    userId_mangaId: {
                        userId,
                        mangaId: entry.mangaId,
                    },
                },
                data: {
                    syncStatus: "SYNCING",
                    syncStartedAt: new Date(),
                    syncFinishedAt: null,
                    syncError: null,
                },
            });
        }

        after(async () => {
            for (const entry of library) {
                try {
                    await checkForUpdates(entry.mangaId);
                    await prisma.userManga.update({
                        where: {
                            userId_mangaId: {
                                userId,
                                mangaId: entry.mangaId,
                            },
                        },
                        data: {
                            syncStatus: "UPDATED",
                            syncFinishedAt: new Date(),
                            syncError: null,
                        },
                    });
                } catch (error) {
                    console.error(`Library update failed for ${entry.manga.title}:`, error);
                    await prisma.userManga.update({
                        where: {
                            userId_mangaId: {
                                userId,
                                mangaId: entry.mangaId,
                            },
                        },
                        data: {
                            syncStatus: "FAILED",
                            syncFinishedAt: new Date(),
                            syncError: error instanceof Error ? error.message : "Unknown update error",
                        },
                    });
                }
            }
        });

        return NextResponse.json({ success: true, queued: library.length });
    } catch (error) {
        console.error("Library update failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
