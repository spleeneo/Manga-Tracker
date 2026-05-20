import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
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
                                sourceUrl.includes("viz.com") ? "VIZ" :
                                    sourceUrl.includes("urekmazino.com") ? "Urek Mazino" :
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
            include: {
                _count: {
                    select: { chapters: true },
                },
            },
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

        // Process all sources
        const hasSources = sourcesToProcess.length > 0;
        let addedSource = false;
        if (sourcesToProcess.length > 0) {
            console.log(`[API] Processing ${sourcesToProcess.length} sources for manga ${finalMangaData.title}`);

            for (const source of sourcesToProcess) {
                const url = source.url || source.sourceUrl; // handle different naming
                if (!url) continue;

                const name = source.name || (
                    url.includes("mangadex") ? "MangaDex" :
                        url.includes("nelomanga") ? "NeloManga" :
                            url.includes("mangaplus") ? "MangaPlus" :
                                url.includes("viz.com") ? "VIZ" :
                                    url.includes("urekmazino.com") ? "Urek Mazino" :
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
                        addedSource = true;
                        console.log(`[API] Added source ${name}`);
                    }

                } catch (e) {
                    console.error(`[API] Failed to add source ${name}:`, e);
                }
            }
        }

        const shouldScrape = hasSources && (!existingManga || existingManga._count.chapters === 0 || addedSource);
        const syncStartedAt = shouldScrape ? new Date() : null;
        const syncFinishedAt = hasSources && !shouldScrape ? new Date() : null;
        const syncStatus = hasSources ? (shouldScrape ? "SYNCING" : "UPDATED") : "IDLE";

        await prisma.userManga.upsert({
            where: {
                    userId_mangaId: {
                    userId,
                    mangaId,
                },
            },
            update: {
                status: "READING",
                syncStatus,
                syncStartedAt,
                syncFinishedAt,
                syncError: null,
            },
            create: {
                userId,
                mangaId,
                status: "READING",
                syncStatus,
                syncStartedAt,
                syncFinishedAt,
            },
        });

        if (shouldScrape) {
            after(async () => {
                try {
                    const { checkForUpdates } = await import("@/lib/manga-updater");
                    await checkForUpdates(mangaId);
                    await prisma.userManga.update({
                        where: {
                            userId_mangaId: {
                                userId,
                                mangaId,
                            },
                        },
                        data: {
                            syncStatus: "UPDATED",
                            syncFinishedAt: new Date(),
                            syncError: null,
                        },
                    });
                } catch (error) {
                    console.error(`[API] Background update failed for ${finalMangaData.title}:`, error);
                    await prisma.userManga.update({
                        where: {
                            userId_mangaId: {
                                userId,
                                mangaId,
                            },
                        },
                        data: {
                            syncStatus: "FAILED",
                            syncFinishedAt: new Date(),
                            syncError: error instanceof Error ? error.message : "Unknown update error",
                        },
                    });
                }
            });
        }

        return NextResponse.json({
            id: mangaId,
            title: finalMangaData.title,
            slug: finalMangaData.slug,
            syncStatus,
        });

    } catch (error) {
        console.error("Error creating manga:", error);
        return NextResponse.json({ error: "Failed to create manga" }, { status: 500 });
    }
}
