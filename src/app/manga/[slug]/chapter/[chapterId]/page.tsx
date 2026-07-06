import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ChapterReader } from "@/components/chapter-reader";
import { isExternalReaderSource } from "@/lib/external-reader-sources";
import { auth } from "../../../../../../auth";
import { getMangaAccess } from "@/lib/parental-controls";
import Link from "next/link";

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
  const access = await getMangaAccess(session.user.id, manga.id);
  if (!access.allowed) return <div className="min-h-screen bg-background"><div className="page-wrap py-16"><div className="surface mx-auto max-w-lg rounded-lg p-8 text-center"><h1 className="text-2xl font-bold">Unavailable under parental controls</h1><Link href="/" className="ui-button ui-button-primary mt-6">Back to library</Link></div></div></div>;

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
      readerStatus: true,
      source: {
        select: {
          sourceName: true,
        },
      },
    },
  });
  if (!chapter) notFound();
  if (access.isChild && chapter.readerStatus !== "READABLE") notFound();

  if (!access.isChild && isExternalReaderSource(chapter.source?.sourceName)) {
    redirect(chapter.url);
  }

  const [previousChapter, nextChapters] = await Promise.all([
    prisma.chapter.findFirst({
      where: {
        mangaId: manga.id,
        ...(chapter.sourceId ? { sourceId: chapter.sourceId } : {}),
        chapterNumber: { lt: chapter.chapterNumber },
        ...(access.isChild ? { readerStatus: "READABLE" } : {}),
      },
      orderBy: { chapterNumber: "desc" },
      select: { id: true, chapterNumber: true, title: true },
    }),
    prisma.chapter.findMany({
      where: {
        mangaId: manga.id,
        ...(chapter.sourceId ? { sourceId: chapter.sourceId } : {}),
        chapterNumber: { gt: chapter.chapterNumber },
        ...(access.isChild ? { readerStatus: "READABLE" } : {}),
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
        url: access.isChild ? `/manga/${manga.slug}/chapter/${chapter.id}` : chapter.url,
        sourceName: access.isChild ? null : chapter.source?.sourceName ?? null,
      }}
      previousChapter={previousChapter}
      nextChapters={nextChapters.map((nextChapter) => ({
        id: nextChapter.id,
        chapterNumber: nextChapter.chapterNumber,
        title: nextChapter.title,
        url: access.isChild ? `/manga/${manga.slug}/chapter/${nextChapter.id}` : nextChapter.url,
        sourceName: access.isChild ? null : nextChapter.source?.sourceName ?? null,
      }))}
    />
  );
}
