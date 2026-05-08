import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { fetchMetadata } from "@/lib/scrapers/registry";
import { getCurrentUserId } from "@/lib/session";

export async function POST(request: Request) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const body = await request.json();
        const { title, slug, coverUrl, status, description, sourceUrl, sources = [] } = body;

        // Normalize sources list
        // If sourceUrl is provided (from manual entry) and not in sources array, add it
        const sourcesToProcess = [...sources];
        if (sourceUrl && !sourcesToProcess.some(s => s.url === sourceUrl)) {
            sourcesToProcess.push({
                url: sourceUrl,
                name:
                    sourceUrl.includes("mangadex") ? "MangaDex" :
                        sourceUrl.includes("nelomanga") ? "NeloManga" :
                            sourceUrl.includes("mangaplus") ? "MangaPlus" :
                                sourceUrl.includes("webtoons") ? "Webtoon" :
                                    (sourceUrl.includes("manganato") || sourceUrl.includes("chapmanganato")) ? "Manganato" :
                                        "Source"
            });
        }

        let finalMangaData = { title, slug, coverUrl, status, description };

        // If we have sources but no detailed metadata, try to fetch from the first one
        if (sourcesToProcess.length > 0 && (!title || !slug)) {
            const primarySource = sourcesToProcess[0];
            try {
                console.log(`[API] Attempting auto-fetch metadata for: ${primarySource.url}`);
                const meta = await fetchMetadata(primarySource.url);
                console.log(`[API] Auto-fetch success: ${meta.title}`);
                finalMangaData = {
                    title: title || meta.title,
                    slug: slug || meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 50),
                    coverUrl: coverUrl || meta.coverUrl,
                    status: (status || meta.status || "ONGOING").toUpperCase(),
                    description: description || meta.description,
                };
            } catch (e) {
                console.error("[API] Auto-fetch metadata failed:", e);
            }
        }

        if (!finalMangaData.title || !finalMangaData.slug) {
            return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
        }

        // Check for existing manga
        const existingManga = await prisma.manga.findUnique({
            where: { slug: finalMangaData.slug },
        });

        const mangaId = existingManga ? existingManga.id : (await prisma.manga.create({
            data: {
                title: finalMangaData.title,
                slug: finalMangaData.slug,
                coverUrl: finalMangaData.coverUrl,
                status: finalMangaData.status,
                description: finalMangaData.description,
            }
        })).id;

        await prisma.userManga.upsert({
            where: {
                    userId_mangaId: {
                    userId,
                    mangaId,
                },
            },
            update: { status: "READING" },
            create: {
                userId,
                mangaId,
                status: "READING",
            },
        });

        // Process all sources
        if (sourcesToProcess.length > 0) {
            console.log(`[API] Processing ${sourcesToProcess.length} sources for manga ${finalMangaData.title}`);
            const { checkForUpdates } = await import("@/lib/manga-updater");

            for (const source of sourcesToProcess) {
                const url = source.url || source.sourceUrl; // handle different naming
                if (!url) continue;

                const name = source.name || (
                    url.includes("mangadex") ? "MangaDex" :
                        url.includes("nelomanga") ? "NeloManga" :
                            url.includes("mangaplus") ? "MangaPlus" :
                                url.includes("webtoons") ? "Webtoon" :
                                    (url.includes("manganato") || url.includes("chapmanganato")) ? "Manganato" :
                                "Source"
                );

                try {
                    // Upsert source
                    // We use findUnique first to avoid unique constraint errors if upsert has race conditions or logic issues
                    const existingSource = await prisma.source.findUnique({
                        where: {
                            mangaId_sourceUrl: {
                                mangaId: mangaId,
                                sourceUrl: url
                            }
                        }
                    });

                    if (!existingSource) {
                        await prisma.source.create({
                            data: {
                                mangaId: mangaId,
                                sourceName: name,
                                sourceUrl: url
                            }
                        });
                        console.log(`[API] Added source ${name}`);
                    }

                    // Trigger update (async, don't wait)
                    checkForUpdates(mangaId).catch(e => console.error(`Failed to update source ${name}:`, e));

                } catch (e) {
                    console.error(`[API] Failed to add source ${name}:`, e);
                }
            }
        }

        // Return the manga with updated data
        const completeManga = await prisma.manga.findUnique({
            where: { id: mangaId },
            include: { sources: true }
        });

        return NextResponse.json(completeManga);

    } catch (error) {
        console.error("Error creating manga:", error);
        return NextResponse.json({ error: "Failed to create manga" }, { status: 500 });
    }
}
