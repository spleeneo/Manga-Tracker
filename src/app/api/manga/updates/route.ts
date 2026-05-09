import { checkForUpdates } from "@/lib/manga-updater";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
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

        const results = [];
        for (const entry of library) {
            const updateResults = await checkForUpdates(entry.mangaId);
            results.push({
                manga: entry.manga.title,
                results: updateResults,
            });
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error("Library update failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
