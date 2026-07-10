import { selectMangaPublicationStatus } from "@/lib/manga-status";
import { fetchMetadata } from "@/lib/scrapers/registry";
import type { MangaMetadata } from "@/lib/scrapers/types";

export type MangaMetadataSource = {
  sourceUrl: string;
};

export type LinkedMangaMetadata = {
  metadata: MangaMetadata[];
  status?: string;
};

export async function fetchLinkedMangaMetadata(
  sources: MangaMetadataSource[],
  fallbackStatus?: string | null,
): Promise<LinkedMangaMetadata> {
  const results = await Promise.allSettled(sources.map((source) => fetchMetadata(source.sourceUrl)));
  const metadata = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);

  return {
    metadata,
    status: selectMangaPublicationStatus(metadata.map((item) => item.status), fallbackStatus),
  };
}
