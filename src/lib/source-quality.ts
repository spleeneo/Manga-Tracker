import { ReaderStatus } from "@/lib/scrapers/types";

export type SourceLane = "manga" | "manhwa-manhua-webtoon" | "single-title";
export type SourceRankingMode = "reader" | "tracking";

export interface SourceQualityProbe {
  provider: string;
  lane: SourceLane;
  query: string;
  matchedTitle?: string;
  exactTitleMatch: boolean;
  falsePositive: boolean;
  sourceUrl?: string;
  chapterCount?: number;
  latestChapterNumber?: number;
  latestReleaseDate?: string;
  missingChapterGaps?: number;
  duplicateChapterNumbers?: number;
  readerStatus?: ReaderStatus;
  readerPageCount?: number;
  catalogEstimate?: number;
  accessIssue?: "blocked" | "rate_limited" | "network" | "parse" | "none";
  isOfficial?: boolean;
  supportsLane?: boolean;
  notes?: string[];
}

export interface ProviderLaneScore {
  provider: string;
  lane: SourceLane;
  sampleCount: number;
  score: number;
  readerScore: number;
  trackingScore: number;
  exactMatchRate: number;
  readableRate: number;
  averageChapterCount: number;
  latestChapterNumber: number;
  accessIssues: number;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function chapterDepthScore(probe: SourceQualityProbe) {
  const chapterCount = probe.chapterCount ?? 0;
  if (chapterCount >= 300) return 20;
  if (chapterCount >= 100) return 16;
  if (chapterCount >= 25) return 10;
  if (chapterCount > 0) return 5;
  return 0;
}

function readerProbeScore(probe: SourceQualityProbe) {
  if (probe.readerStatus === "READABLE" && (probe.readerPageCount ?? 0) >= 3) return 30;
  if (probe.readerStatus === "READABLE") return 22;
  if (probe.readerStatus === "EXTERNAL_ONLY") return 8;
  if (probe.readerStatus === "BLOCKED" || probe.readerStatus === "PAYWALLED") return -10;
  if (probe.readerStatus === "ERROR") return -5;
  return 0;
}

function trackingProbeScore(probe: SourceQualityProbe) {
  let score = 0;
  if (probe.exactTitleMatch) score += 20;
  if (probe.falsePositive) score -= 20;
  score += chapterDepthScore(probe);
  if ((probe.latestChapterNumber ?? 0) > 0) score += 10;
  if ((probe.missingChapterGaps ?? 0) === 0 && (probe.chapterCount ?? 0) > 0) score += 5;
  if ((probe.duplicateChapterNumbers ?? 0) > 0) score -= 5;
  if (probe.accessIssue && probe.accessIssue !== "none") score -= 15;
  if (probe.supportsLane === false) score -= 30;
  if (probe.isOfficial) score += 8;
  return score;
}

export function scoreProbe(probe: SourceQualityProbe, mode: SourceRankingMode) {
  const base = trackingProbeScore(probe);
  const reader = readerProbeScore(probe);
  const catalog = probe.catalogEstimate ? Math.min(15, Math.log10(probe.catalogEstimate) * 4) : 0;
  const lanePenalty = probe.supportsLane === false ? 25 : 0;

  if (mode === "reader") {
    return clampScore(base + reader + catalog - lanePenalty);
  }

  return clampScore(base + catalog + reader / 3 - lanePenalty);
}

export function summarizeProviderLane(
  probes: SourceQualityProbe[],
  lane: SourceLane,
  mode: SourceRankingMode,
): ProviderLaneScore[] {
  const byProvider = new Map<string, SourceQualityProbe[]>();

  for (const probe of probes.filter((item) => item.lane === lane)) {
    byProvider.set(probe.provider, [...(byProvider.get(probe.provider) ?? []), probe]);
  }

  return Array.from(byProvider.entries())
    .map(([provider, providerProbes]) => {
      const readerScores = providerProbes.map((probe) => scoreProbe(probe, "reader"));
      const trackingScores = providerProbes.map((probe) => scoreProbe(probe, "tracking"));
      const selectedScores = mode === "reader" ? readerScores : trackingScores;
      const exactMatches = providerProbes.filter((probe) => probe.exactTitleMatch).length;
      const readable = providerProbes.filter((probe) => probe.readerStatus === "READABLE").length;
      const accessIssues = providerProbes.filter((probe) => probe.accessIssue && probe.accessIssue !== "none").length;

      return {
        provider,
        lane,
        sampleCount: providerProbes.length,
        score: clampScore(average(selectedScores)),
        readerScore: clampScore(average(readerScores)),
        trackingScore: clampScore(average(trackingScores)),
        exactMatchRate: Math.round((exactMatches / providerProbes.length) * 100),
        readableRate: Math.round((readable / providerProbes.length) * 100),
        averageChapterCount: Math.round(average(providerProbes.map((probe) => probe.chapterCount ?? 0))),
        latestChapterNumber: Math.max(...providerProbes.map((probe) => probe.latestChapterNumber ?? 0)),
        accessIssues,
      };
    })
    .sort((a, b) => b.score - a.score || b.exactMatchRate - a.exactMatchRate || a.provider.localeCompare(b.provider));
}

export function countChapterQuality(chapterNumbers: number[]) {
  const normalized = chapterNumbers
    .filter((chapterNumber) => Number.isFinite(chapterNumber) && chapterNumber > 0)
    .map((chapterNumber) => Number(chapterNumber.toFixed(3)));
  const unique = new Set(normalized);
  const integerChapters = [...unique].filter(Number.isInteger).sort((a, b) => a - b);
  let missingChapterGaps = 0;

  for (let index = 1; index < integerChapters.length; index += 1) {
    const gap = integerChapters[index] - integerChapters[index - 1];
    if (gap > 1) missingChapterGaps += gap - 1;
  }

  return {
    duplicateChapterNumbers: normalized.length - unique.size,
    missingChapterGaps,
  };
}
