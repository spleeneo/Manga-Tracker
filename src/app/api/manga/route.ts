import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { fetchMetadata } from "@/lib/scrapers/registry";
import { getCurrentUserId } from "@/lib/session";
import { inferSourceName } from "@/lib/source-name";
import { normalizeMangaStatus } from "@/lib/manga-status";
import { enqueueMangaSyncJob, processSyncJob } from "@/lib/sync-jobs";
import { getCanonicalMangaSlug, getCanonicalMangaTitle, getMangaAliasSlugs } from "@/lib/manga-aliases";
import { applySourceOverrideToInputSources } from "@/lib/source-overrides";

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
        let sourcesToProcess = [...sources];
        if (sourceUrl && !sourcesToProcess.some(s => s.url === sourceUrl)) {
            sourcesToProcess.push({
                url: sourceUrl,
                name: inferSourceName(sourceUrl),
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
                    status: normalizeMangaStatus(status || meta.status, "ONGOING"),
                    description: description || meta.description,
                };
            } catch (e) {
                console.error("[API] Auto-fetch metadata failed:", e);
            }
        }

        if (!finalMangaData.title || !finalMangaData.slug) {
            return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
        }

        finalMangaData = {
            ...finalMangaData,
            title: getCanonicalMangaTitle(finalMangaData.title),
            slug: getCanonicalMangaSlug(finalMangaData.title, finalMangaData.slug),
        };
        sourcesToProcess = applySourceOverrideToInputSources(finalMangaData, sourcesToProcess);
        const sourceUrls = sourcesToProcess
            .map((source) => source.url || source.sourceUrl)
            .filter((url): url is string => Boolean(url));

        // Check for existing manga
        let existingManga = await prisma.manga.findUnique({
            where: { slug: finalMangaData.slug },
            include: {
                _count: {
                    select: { chapters: true },
                },
            },
        });

        if (!existingManga) {
            const aliasSlugs = getMangaAliasSlugs(finalMangaData.title, finalMangaData.slug);
            const aliasManga = aliasSlugs.length > 0 ? await prisma.manga.findFirst({
                where: { slug: { in: aliasSlugs } },
                include: {
                    _count: {
                        select: { chapters: true },
                    },
                },
            }) : null;

            if (aliasManga) {
                existingManga = await prisma.manga.update({
                    where: { id: aliasManga.id },
                    data: {
                        title: finalMangaData.title,
                        slug: finalMangaData.slug,
                    },
                    include: {
                        _count: {
                            select: { chapters: true },
                        },
                    },
                });
            }
        }

        if (!existingManga && sourceUrls.length > 0) {
            const existingSource = await prisma.source.findFirst({
                where: { sourceUrl: { in: sourceUrls } },
                include: {
                    manga: {
                        include: {
                            _count: {
                                select: { chapters: true },
                            },
                        },
                    },
                },
            });

            if (existingSource) {
                existingManga = existingSource.manga;
                finalMangaData = {
                    ...finalMangaData,
                    title: existingManga.title,
                    slug: existingManga.slug,
                    coverUrl: finalMangaData.coverUrl || existingManga.coverUrl,
                    status: finalMangaData.status || existingManga.status,
                    description: finalMangaData.description || existingManga.description,
                };
            }
        }

        const mangaId = existingManga ? existingManga.id : (await prisma.manga.create({
            data: {
                title: finalMangaData.title,
                slug: finalMangaData.slug,
                coverUrl: finalMangaData.coverUrl,
                status: normalizeMangaStatus(finalMangaData.status, "ONGOING"),
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

                const name = source.name || inferSourceName(url);

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
            const job = await enqueueMangaSyncJob(userId, mangaId);
            after(async () => {
                await processSyncJob(job.id);
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
