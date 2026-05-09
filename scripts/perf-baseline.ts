import { Prisma, PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";

const prisma = new PrismaClient();

type Measurement = {
  label: string;
  samplesMs: number[];
  medianMs: number;
  minMs: number;
  maxMs: number;
  notes?: string;
};

const ROLLBACK = new Error("rollback perf benchmark");

function percentile(values: number[], percentileValue: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

async function measure(label: string, fn: () => Promise<unknown>, runs = 5, notes?: string): Promise<Measurement> {
  const samplesMs: number[] = [];

  for (let i = 0; i < runs; i += 1) {
    const started = performance.now();
    await fn();
    samplesMs.push(Math.round(performance.now() - started));
  }

  return {
    label,
    samplesMs,
    medianMs: percentile(samplesMs, 50),
    minMs: Math.min(...samplesMs),
    maxMs: Math.max(...samplesMs),
    notes,
  };
}

async function measureHttp(label: string, url: string, runs = 5, notes?: string): Promise<Measurement> {
  return measure(
    label,
    async () => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${label} failed: ${response.status} ${response.statusText}`);
      }
      await response.arrayBuffer();
    },
    runs,
    notes,
  );
}

async function findSampleUser() {
  return prisma.user.findFirst({
    where: { library: { some: {} } },
    select: { id: true, email: true },
  });
}

async function runHomeQuery(userId: string) {
  const library = await prisma.userManga.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      lastReadChapterNumber: true,
      manga: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          status: true,
        },
      },
    },
  });
  const mangaIds = library.map((entry) => entry.manga.id);
  const bestChapters = mangaIds.length > 0
    ? await prisma.$queryRaw<Array<{ mangaId: string; chapterNumber: number; url: string; releaseDate: Date | null }>>`
      SELECT DISTINCT ON (c."mangaId", c."chapterNumber")
        c."mangaId" AS "mangaId",
        c."chapterNumber" AS "chapterNumber",
        c."url" AS "url",
        c."releaseDate" AS "releaseDate"
      FROM "Chapter" c
      LEFT JOIN "Source" s ON s."id" = c."sourceId"
      WHERE c."mangaId" IN (${Prisma.join(mangaIds)})
      ORDER BY
        c."mangaId",
        c."chapterNumber" DESC,
        CASE LOWER(COALESCE(s."sourceName", ''))
          WHEN 'mangaplus' THEN 5
          WHEN 'mangadex' THEN 4
          WHEN 'webtoon' THEN 3
          WHEN 'nelomanga' THEN 2
          WHEN 'manganato' THEN 1
          ELSE 0
        END DESC,
        c."releaseDate" DESC NULLS LAST,
        c."createdAt" DESC
    `
    : [];

  return {
    librarySize: library.length,
    distinctChapterRows: bestChapters.length,
    approxPayloadBytes: Buffer.byteLength(JSON.stringify({ library, bestChapters })),
  };
}

async function runDetailQuery(userId: string, slug: string) {
  const manga = await prisma.manga.findUnique({
    where: { slug },
    include: {
      sources: true,
      chapters: {
        orderBy: { chapterNumber: "desc" },
        take: 61,
      },
    },
  });

  if (!manga) return null;

  const tracked = await prisma.userManga.findUnique({
    where: {
      userId_mangaId: {
        userId,
        mangaId: manga.id,
      },
    },
  });
  if (!tracked) return null;

  return {
    sources: manga.sources.length,
    chapterRows: manga.chapters.length,
    lastReadChapterNumber: tracked.lastReadChapterNumber,
    approxPayloadBytes: Buffer.byteLength(JSON.stringify({ manga, tracked })),
  };
}

async function runProgressWrite(userId: string, mangaId: string, chapterNumber: number | null) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.userManga.update({
        where: {
          userId_mangaId: {
            userId,
            mangaId,
          },
        },
        data: {
          lastReadChapterNumber: chapterNumber,
          lastReadAt: chapterNumber == null ? null : new Date(),
        },
      });

      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
}

async function main() {
  const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3100";
  const sampleUser = await findSampleUser();
  if (!sampleUser) {
    throw new Error("No sample user with tracked manga found.");
  }

  const sampleManga = await prisma.userManga.findFirst({
    where: { userId: sampleUser.id },
    include: {
      manga: {
        include: {
          chapters: {
            orderBy: { chapterNumber: "desc" },
            take: 50,
            select: { id: true },
          },
        },
      },
    },
  });
  if (!sampleManga || sampleManga.manga.chapters.length === 0) {
    throw new Error("No sample tracked manga with chapters found.");
  }

  const counts = await Promise.all([
    prisma.manga.count(),
    prisma.source.count(),
    prisma.chapter.count(),
    prisma.user.count(),
    prisma.userManga.count(),
    prisma.userChapter.count(),
  ]);

  const homeShape = await runHomeQuery(sampleUser.id);
  const detailShape = await runDetailQuery(sampleUser.id, sampleManga.manga.slug);
  const sampleChapterIds = sampleManga.manga.chapters.map((chapter) => chapter.id);
  const latestChapterNumber = await prisma.chapter.aggregate({
    where: { mangaId: sampleManga.manga.id },
    _max: { chapterNumber: true },
  });
  const coverUrl = sampleManga.manga.coverUrl
    ? `${baseUrl}/api/proxy/image?url=${encodeURIComponent(sampleManga.manga.coverUrl)}`
    : null;

  const measurements: Measurement[] = [];
  measurements.push(await measure("db: home signed-in summary query", () => runHomeQuery(sampleUser.id), 7, "Mirrors summary-based src/app/page.tsx data shape."));
  measurements.push(await measure("db: manga detail paged query path", () => runDetailQuery(sampleUser.id, sampleManga.manga.slug), 7, "Mirrors src/app/manga/[slug]/page.tsx initial paged data shape."));
  measurements.push(await measure("db: progress write rollback", () => runProgressWrite(sampleUser.id, sampleManga.manga.id, latestChapterNumber._max.chapterNumber), 7, "Equivalent to POST /api/manga/[slug]/progress without HTTP/session overhead."));
  measurements.push(await measureHttp("http: unauthenticated home shell", baseUrl, 5, "Production server smoke; signed-in HTTP requires browser session cookies."));
  measurements.push(await measureHttp("http: add manga search API", `${baseUrl}/api/manga/search?q=one%20piece`, 3, "Provider/network dependent."));
  if (coverUrl) {
    measurements.push(await measureHttp("http: proxied cover image", coverUrl, 5, "Provider/network dependent; app sends immutable cache header."));
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    sampleUser: sampleUser.email,
    sampleManga: sampleManga.manga.slug,
    counts: {
      manga: counts[0],
      sources: counts[1],
      chapters: counts[2],
      users: counts[3],
      userManga: counts[4],
      userChapters: counts[5],
    },
    shapes: {
      home: homeShape,
      detail: detailShape,
      priorCaughtUpSampleChapterCount: sampleChapterIds.length,
    },
    measurements,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
