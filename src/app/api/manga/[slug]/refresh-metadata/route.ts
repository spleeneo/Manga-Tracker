import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getMangaAccess, parentalControlError } from "@/lib/parental-controls";
import { refreshMangaClassification } from "@/lib/content-classification";
import { fetchLinkedMangaMetadata } from "@/lib/manga-metadata";

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

        if (manga.sources.length === 0) {
            return NextResponse.json({ error: "No sources linked to this manga" }, { status: 400 });
        }

        console.log(`[API] Refreshing metadata for ${manga.title} via ${manga.sources.length} linked source(s)`);

        const linkedMetadata = await fetchLinkedMangaMetadata(manga.sources, manga.status);
        const meta = linkedMetadata.metadata[0];

        const updatedManga = await prisma.manga.update({
            where: { id: manga.id },
            data: {
                title: meta?.title || manga.title,
                coverUrl: meta?.coverUrl || manga.coverUrl,
                status: linkedMetadata.status ?? manga.status,
                description: meta?.description || manga.description,
                contentRating: meta?.classificationSource === "MANGADEX" ? meta.contentRating?.toLowerCase() : manga.contentRating,
                classificationSource: meta?.classificationSource ?? manga.classificationSource,
                classifiedAt: meta?.classificationSource ? new Date() : manga.classifiedAt,
                tags: meta?.classificationSource === "MANGADEX" && meta.tags ? {
                    deleteMany: {},
                    create: meta.tags.map((tag) => ({ tag: { connectOrCreate: { where: { id: tag.id }, create: { id: tag.id, name: tag.name, group: tag.group } } } })),
                } : undefined,
                updatedAt: new Date()
            }
        });
        await refreshMangaClassification(manga.id);

        return NextResponse.json(updatedManga);
    } catch (error) {
        console.error("Failed to refresh metadata:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
