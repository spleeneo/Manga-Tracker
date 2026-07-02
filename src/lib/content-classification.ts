import { prisma } from "@/lib/db";
import { fetchMetadata } from "@/lib/scrapers/registry";
import { mergeClassifications } from "@/lib/classification-utils";
export { extractClassificationTags, inferContentRating, mergeClassifications, withProviderClassification } from "@/lib/classification-utils";

export async function refreshMangaClassification(mangaId: string) {
  const manga = await prisma.manga.findUnique({ where: { id: mangaId }, select: { sources: { select: { sourceUrl: true } } } });
  if (!manga) return null;
  const results = await Promise.allSettled(manga.sources.map((source) => fetchMetadata(source.sourceUrl)));
  const merged = mergeClassifications(results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
  if (!merged.classificationSource) return merged;
  await prisma.manga.update({ where: { id: mangaId }, data: {
    contentRating: merged.contentRating,
    classificationSource: merged.classificationSource,
    classifiedAt: new Date(),
    tags: { deleteMany: {}, create: merged.tags.map((tag) => ({ tag: { connectOrCreate: { where: { id: tag.id }, create: tag } } })) },
  } });
  return merged;
}
