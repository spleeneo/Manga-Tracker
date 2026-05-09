import { PrismaClient } from "@prisma/client";
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
    include: {
      manga: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          status: true,
          chapters: {
            orderBy: { chapterNumber: "desc" },
            select: {
              id: true,
              chapterNumber: true,
              url: true,
              releaseDate: true,
              userChapters: {
                where: { userId },
                select: { isRead: true },
              },
            },
          },
          sources: true,
        },
      },
    },
  });

  return {
    librarySize: library.length,
    chapterRows: library.reduce((total, entry) => total + entry.manga.chapters.length, 0),
    approxPayloadBytes: Buffer.byteLength(JSON.stringify(library)),
  };
}

async function runDetailQuery(userId: string, slug: string) {
  const manga = await prisma.manga.findUnique({
    where: { slug },
    include: {
      sources: true,
      chapters: {
        orderBy: { chapterNumber: "desc" },
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

  const userChapters = await prisma.userChapter.findMany({
    where: {
      userId,
      chapterId: { in: manga.chapters.map((chapter) => chapter.id) },
    },
  });

  return {
    sources: manga.sources.length,
    chapterRows: manga.chapters.length,
    readRows: userChapters.length,
    approxPayloadBytes: Buffer.byteLength(JSON.stringify({ manga, userChapters })),
  };
}

async function runSingleReadWrite(userId: string, chapterId: string, isRead: boolean) {
  try {
    await prisma.$transaction(async (tx) => {
      const chapter = await tx.chapter.findUnique({
        where: { id: chapterId },
        select: { id: true, mangaId: true },
      });
      if (!chapter) throw new Error("sample chapter missing");

      const tracked = await tx.userManga.findUnique({
        where: {
          userId_mangaId: {
            userId,
            mangaId: chapter.mangaId,
          },
        },
      });
      if (!tracked) throw new Error("sample manga not tracked");

      await tx.userChapter.upsert({
        where: {
          userId_chapterId: {
            userId,
            chapterId: chapter.id,
          },
        },
        update: {
          isRead,
          readAt: isRead ? new Date() : null,
        },
        create: {
          userId,
          chapterId: chapter.id,
          isRead,
          readAt: isRead ? new Date() : null,
        },
      });

      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
}

async function runBatchReadWrite(userId: string, chapterIds: string[], isRead: boolean) {
  try {
    await prisma.$transaction(async (tx) => {
      const chapters = await tx.chapter.findMany({
        where: { id: { in: chapterIds } },
        select: { id: true, mangaId: true },
      });
      const mangaIds = [...new Set(chapters.map((chapter) => chapter.mangaId))];
      const tracked = await tx.userManga.findMany({
        where: {
          userId,
          mangaId: { in: mangaIds },
        },
        select: { mangaId: true },
      });
      const trackedMangaIds = new Set(tracked.map((entry) => entry.mangaId));
      if (chapters.some((chapter) => !trackedMangaIds.has(chapter.mangaId))) {
        throw new Error("sample batch contains untracked manga");
      }

      for (const chapter of chapters) {
        await tx.userChapter.upsert({
          where: {
            userId_chapterId: {
              userId,
              chapterId: chapter.id,
            },
          },
          update: {
            isRead,
            readAt: isRead ? new Date() : null,
          },
          create: {
            userId,
            chapterId: chapter.id,
            isRead,
            readAt: isRead ? new Date() : null,
          },
        });
      }

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
  const coverUrl = sampleManga.manga.coverUrl
    ? `${baseUrl}/api/proxy/image?url=${encodeURIComponent(sampleManga.manga.coverUrl)}`
    : null;

  const measurements: Measurement[] = [];
  measurements.push(await measure("db: home signed-in library query", () => runHomeQuery(sampleUser.id), 7, "Mirrors src/app/page.tsx data shape."));
  measurements.push(await measure("db: manga detail query path", () => runDetailQuery(sampleUser.id, sampleManga.manga.slug), 7, "Mirrors src/app/manga/[slug]/page.tsx data shape."));
  measurements.push(await measure("db: single chapter read write rollback", () => runSingleReadWrite(sampleUser.id, sampleChapterIds[0], true), 7, "Equivalent to one POST /api/manga/chapter/[id]/read without HTTP/session overhead."));
  measurements.push(await measure("db: current caught-up write loop rollback", () => runBatchReadWrite(sampleUser.id, sampleChapterIds, true), 5, `Sequential rollback lower-bound for ${sampleChapterIds.length} chapter writes.`));
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
      caughtUpSampleChapterCount: sampleChapterIds.length,
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
