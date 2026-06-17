import { getPreferredSourceRank } from "@/lib/source-preference";

export type RankedSource = {
  id: string;
  sourceName: string;
  position?: number | null;
};

export function getSourceRankScore(source: RankedSource | undefined, mangaSlug?: string | null) {
  if (!source) return 0;
  if (typeof source.position === "number" && Number.isFinite(source.position)) {
    return 10_000 - source.position;
  }

  return getPreferredSourceRank(source.sourceName, mangaSlug);
}

export function getSourceRankMap(sources: RankedSource[], mangaSlug?: string | null) {
  return Object.fromEntries(
    sources.map((source) => [source.id, getSourceRankScore(source, mangaSlug)]),
  );
}
