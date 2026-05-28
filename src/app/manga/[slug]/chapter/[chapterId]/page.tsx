import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ChapterReader } from "@/components/chapter-reader";
import { isExternalReaderSource } from "@/lib/external-reader-sources";
import { auth } from "../../../../../../auth";

interface PageProps {
  params: Promise<{
    slug: string;
    chapterId: string;
  }>;
}

export default async function ReaderPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { slug, chapterId } = await params;
  const manga = await prisma.manga.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
    },
  });
  if (!manga) notFound();

  const tracked = await prisma.userManga.findUnique({
    where: {
      userId_mangaId: {
        userId: session.user.id,
        mangaId: manga.id,
      },
    },
    select: { id: true },
  });
  if (!tracked) notFound();

  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      mangaId: manga.id,
    },
    select: {
      id: true,
      chapterNumber: true,
      title: true,
      url: true,
      sourceId: true,
      source: {
        select: {
          sourceName: true,
        },
      },
    },
  });
  if (!chapter) notFound();

  if (isExternalReaderSource(chapter.source?.sourceName)) {
    redirect(chapter.url);
  }

  const [previousChapter, nextChapters] = await Promise.all([
    prisma.chapter.findFirst({
      where: {
        mangaId: manga.id,
        ...(chapter.sourceId ? { sourceId: chapter.sourceId } : {}),
        chapterNumber: { lt: chapter.chapterNumber },
      },
      orderBy: { chapterNumber: "desc" },
      select: { id: true, chapterNumber: true, title: true },
    }),
    prisma.chapter.findMany({
      where: {
        mangaId: manga.id,
        ...(chapter.sourceId ? { sourceId: chapter.sourceId } : {}),
        chapterNumber: { gt: chapter.chapterNumber },
      },
      orderBy: { chapterNumber: "asc" },
      take: 1,
      select: {
        id: true,
        chapterNumber: true,
        title: true,
        url: true,
        source: {
          select: {
            sourceName: true,
          },
        },
      },
    }),
  ]);

  return (
    <ChapterReader
      key={chapter.id}
      slug={manga.slug}
      mangaTitle={manga.title}
      chapter={{
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        url: chapter.url,
        sourceName: chapter.source?.sourceName ?? null,
      }}
      previousChapter={previousChapter}
      nextChapters={nextChapters.map((nextChapter) => ({
        id: nextChapter.id,
        chapterNumber: nextChapter.chapterNumber,
        title: nextChapter.title,
        url: nextChapter.url,
        sourceName: nextChapter.source?.sourceName ?? null,
      }))}
    />
  );
}
