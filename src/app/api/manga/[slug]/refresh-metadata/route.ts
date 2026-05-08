import { prisma } from "@/lib/db";
import { fetchMetadata } from "@/lib/scrapers/registry";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";

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
            where: { slug },
            include: { sources: true }
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

        if (manga.sources.length === 0) {
            return NextResponse.json({ error: "No sources linked to this manga" }, { status: 400 });
        }

        // Use the first source to refresh metadata
        const source = manga.sources[0];
        console.log(`[API] Refreshing metadata for ${manga.title} via ${source.sourceName}`);

        const meta = await fetchMetadata(source.sourceUrl);

        const updatedManga = await prisma.manga.update({
            where: { id: manga.id },
            data: {
                title: meta.title || manga.title,
                coverUrl: meta.coverUrl || manga.coverUrl,
                status: (meta.status || manga.status || "ONGOING").toUpperCase(),
                description: meta.description || manga.description,
                updatedAt: new Date()
            }
        });

        return NextResponse.json(updatedManga);
    } catch (error) {
        console.error("Failed to refresh metadata:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
