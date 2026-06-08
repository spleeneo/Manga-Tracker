import { getRegisteredScrapers } from "../src/lib/scrapers/registry";
import { ReaderResult, ScrapedChapter, Scraper, SearchResult } from "../src/lib/scrapers/types";
import {
  countChapterQuality,
  SourceLane,
  SourceQualityProbe,
  summarizeProviderLane,
} from "../src/lib/source-quality";

type SampleTitle = {
  query: string;
  lane: SourceLane;
  aliases: string[];
};

type ProviderLike = {
  name: string;
  isOfficial?: boolean;
  catalogEstimate?: number;
  supportsLane?: (lane: SourceLane) => boolean;
  search: (query: string) => Promise<SearchResult[]>;
  fetchChapters: (sourceUrl: string) => Promise<ScrapedChapter[]>;
  fetchReaderPages?: Scraper["fetchReaderPages"];
};

const SAMPLE_TITLES: SampleTitle[] = [
  { query: "one piece", lane: "manga", aliases: ["one piece"] },
  { query: "dandadan", lane: "manga", aliases: ["dandadan"] },
  { query: "blue lock", lane: "manga", aliases: ["blue lock"] },
  { query: "witch hat atelier", lane: "manga", aliases: ["witch hat atelier", "tongari boushi no atelier", "tongari boshi no atelier", "tongari boushi no atelier atelier of witch hat"] },
  { query: "one-punch man", lane: "manga", aliases: ["one-punch man", "one punch man", "onepunch man"] },
  { query: "kingdom", lane: "manga", aliases: ["kingdom"] },
  { query: "chainsaw man", lane: "manga", aliases: ["chainsaw man"] },
  { query: "spy x family", lane: "manga", aliases: ["spy x family", "spy family"] },
  { query: "solo leveling", lane: "manhwa-manhua-webtoon", aliases: ["solo leveling"] },
  { query: "omniscient reader", lane: "manhwa-manhua-webtoon", aliases: ["omniscient reader", "omniscient reader's viewpoint"] },
  { query: "tales of demons and gods", lane: "manhwa-manhua-webtoon", aliases: ["tales of demons and gods"] },
  { query: "subzero", lane: "manhwa-manhua-webtoon", aliases: ["subzero", "subzero"] },
  { query: "blue lock", lane: "single-title", aliases: ["blue lock"] },
  { query: "witch hat atelier", lane: "single-title", aliases: ["witch hat atelier", "tongari boushi no atelier", "tongari boushi no atelier atelier of witch hat"] },
];

const PROVIDERS_TO_COMPARE = new Set([
  "Single Manga Sites",
  "MangaDex",
  "NeloManga",
  "MangaPlus",
  "Comikey",
  "VIZ",
  "Webtoon",
  "Manganato",
  "MangaPill",
  "Atsumaru",
]);

const OFFICIAL_PROVIDERS = new Set(["MangaDex", "MangaPlus", "Comikey", "VIZ", "Webtoon"]);

function normalizeTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesSampleTitle(foundTitle: string | undefined, sample: SampleTitle) {
  if (!foundTitle) return false;
  const normalizedFound = normalizeTitle(foundTitle);
  return sample.aliases.some((alias) => normalizedFound === normalizeTitle(alias));
}

function latestChapter(chapters: ScrapedChapter[]) {
  return [...chapters]
    .filter((chapter) => Number.isFinite(chapter.chapterNumber))
    .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
}

function toDateOnly(date: Date | undefined) {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function classifyError(error: unknown): SourceQualityProbe["accessIssue"] {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("403") || message.includes("blocked") || message.includes("banned")) return "blocked";
  if (message.includes("429") || message.includes("rate")) return "rate_limited";
  if (message.includes("parse") || message.includes("json")) return "parse";
  return "network";
}

function getArgValue(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function fetchHtml(url: string, referer?: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
      ...(referer ? { Referer: referer } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`MangaPill request failed with ${response.status}`);
  }

  return response.text();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

class MangaPillCandidate implements ProviderLike {
  name = "MangaPill";
  catalogEstimate = 10_000;

  supportsLane(lane: SourceLane) {
    return lane !== "manhwa-manhua-webtoon";
  }

  async search(query: string): Promise<SearchResult[]> {
    const html = await fetchHtml(`https://mangapill.com/search?q=${encodeURIComponent(query)}`);
    const matches = Array.from(html.matchAll(/<a[^>]+href="(\/manga\/\d+\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi));
    const resultsByUrl = new Map<string, SearchResult>();

    for (const match of matches) {
      const sourceUrl = new URL(match[1], "https://mangapill.com").toString();
      const title = decodeHtml(match[2].replace(/<figure[\s\S]*?<\/figure>/gi, " ").replace(/<[^>]+>/g, " "));
      const existing = resultsByUrl.get(sourceUrl);

      resultsByUrl.set(sourceUrl, {
        title: title || existing?.title || "",
        sourceUrl,
        sourceName: this.name,
      });
    }

    return Array.from(resultsByUrl.values()).filter((result) => result.title).slice(0, 50);
  }

  async fetchChapters(sourceUrl: string): Promise<ScrapedChapter[]> {
    const html = await fetchHtml(sourceUrl);
    const matches = Array.from(html.matchAll(/href="(\/chapters\/[^"]+?chapter-([\d.]+))"/gi));
    const seen = new Set<string>();

    return matches
      .map((match) => ({
        providerChapterId: match[1].split("/")[2],
        chapterNumber: Number(match[2]),
        title: `Chapter ${match[2]}`,
        url: new URL(match[1], "https://mangapill.com").toString(),
      }))
      .filter((chapter) => {
        if (!Number.isFinite(chapter.chapterNumber) || seen.has(chapter.url)) return false;
        seen.add(chapter.url);
        return true;
      });
  }

  async fetchReaderPages(chapter: { url: string }, source: { sourceUrl: string }): Promise<ReaderResult> {
    const html = await fetchHtml(chapter.url, source.sourceUrl);
    const pages = Array.from(html.matchAll(/(?:src|data-src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi))
      .map((match) => match[1])
      .filter((url) => url.includes("/file/mangap/"));

    return {
      status: pages.length > 0 ? "READABLE" : "EXTERNAL_ONLY",
      pages: pages.map((imageUrl, index) => ({ index, imageUrl })),
      externalUrl: chapter.url,
    };
  }
}

async function probeProvider(provider: ProviderLike, sample: SampleTitle): Promise<SourceQualityProbe> {
  const baseProbe: SourceQualityProbe = {
    provider: provider.name,
    lane: sample.lane,
    query: sample.query,
    exactTitleMatch: false,
    falsePositive: false,
    catalogEstimate: provider.catalogEstimate,
    accessIssue: "none",
    isOfficial: provider.isOfficial,
    supportsLane: provider.supportsLane?.(sample.lane) ?? true,
  };

  if (baseProbe.supportsLane === false) {
    return {
      ...baseProbe,
      notes: [`${provider.name} does not support the ${sample.lane} lane.`],
    };
  }

  try {
    const results = await provider.search(sample.query);
    const bestMatch = results.find((result) => matchesSampleTitle(result.title, sample)) ?? results[0];
    const exactTitleMatch = matchesSampleTitle(bestMatch?.title, sample);

    if (!bestMatch) {
      return {
        ...baseProbe,
        notes: ["No search result."],
      };
    }

    const chapters = await provider.fetchChapters(bestMatch.sourceUrl);
    const latest = latestChapter(chapters);
    const quality = countChapterQuality(chapters.map((chapter) => chapter.chapterNumber));
    let reader: ReaderResult | undefined;

    if (provider.fetchReaderPages && latest) {
      reader = await provider.fetchReaderPages(
        {
          id: "source-quality-probe",
          providerChapterId: latest.providerChapterId ?? null,
          url: latest.url,
          chapterNumber: latest.chapterNumber,
          title: latest.title ?? null,
        },
        { id: "source-quality-probe-source", sourceName: provider.name, sourceUrl: bestMatch.sourceUrl },
      );
    }

    return {
      ...baseProbe,
      matchedTitle: bestMatch.title,
      exactTitleMatch,
      falsePositive: !exactTitleMatch,
      sourceUrl: bestMatch.sourceUrl,
      chapterCount: chapters.length,
      latestChapterNumber: latest?.chapterNumber,
      latestReleaseDate: toDateOnly(latest?.releaseDate),
      missingChapterGaps: quality.missingChapterGaps,
      duplicateChapterNumbers: quality.duplicateChapterNumbers,
      readerStatus: reader?.status,
      readerPageCount: reader?.pages.length,
    };
  } catch (error) {
    return {
      ...baseProbe,
      accessIssue: classifyError(error),
      notes: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function getProviders(): ProviderLike[] {
  const registeredProviders = getRegisteredScrapers()
    .filter((provider) => PROVIDERS_TO_COMPARE.has(provider.name))
    .map((provider) => ({
      name: provider.name,
      isOfficial: OFFICIAL_PROVIDERS.has(provider.name),
      catalogEstimate: provider.name === "MangaPill" ? 10_000 : undefined,
      search: provider.search.bind(provider),
      fetchChapters: provider.fetchChapters.bind(provider),
      fetchReaderPages: provider.capabilities?.reader && provider.fetchReaderPages
        ? provider.fetchReaderPages.bind(provider)
        : undefined,
      supportsLane: (lane: SourceLane) => {
        if (provider.name === "Single Manga Sites") return lane === "single-title";
        if (provider.name === "MangaPill") return lane !== "manhwa-manhua-webtoon";
        return true;
      },
    }));

  return registeredProviders.some((provider) => provider.name === "MangaPill")
    ? registeredProviders
    : [...registeredProviders, new MangaPillCandidate()];
}

function printRanking(probes: SourceQualityProbe[]) {
  const sections: Array<[string, SourceLane, "reader" | "tracking"]> = [
    ["Best manga reader source", "manga", "reader"],
    ["Best manga tracking source", "manga", "tracking"],
    ["Best manhwa/manhua/webtoon source", "manhwa-manhua-webtoon", "tracking"],
    ["Best fallback/single-title source", "single-title", "reader"],
  ];

  for (const [title, lane, mode] of sections) {
    console.log(`\n## ${title}`);
    console.log("| Rank | Provider | Score | Exact match | Readable | Avg chapters | Latest # | Access issues |");
    console.log("| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    summarizeProviderLane(probes, lane, mode).forEach((row, index) => {
      console.log(`| ${index + 1} | ${row.provider} | ${row.score} | ${row.exactMatchRate}% | ${row.readableRate}% | ${row.averageChapterCount} | ${row.latestChapterNumber} | ${row.accessIssues} |`);
    });
  }
}

function printEvidence(probes: SourceQualityProbe[]) {
  console.log("\n## Sample evidence");
  console.log("| Lane | Query | Provider | Match | Chapters | Latest # | Reader | Pages | Issue | Notes |");
  console.log("| --- | --- | --- | --- | ---: | ---: | --- | ---: | --- | --- |");

  for (const probe of probes) {
    console.log([
      `| ${probe.lane}`,
      probe.query,
      probe.provider,
      probe.matchedTitle ?? "",
      String(probe.chapterCount ?? 0),
      String(probe.latestChapterNumber ?? ""),
      probe.readerStatus ?? "",
      String(probe.readerPageCount ?? 0),
      probe.accessIssue ?? "none",
      probe.notes?.join("; ") ?? "",
    ].join(" | ") + " |");
  }
}

async function main() {
  const providerFilter = getArgValue("--provider");
  const laneFilter = getArgValue("--lane") as SourceLane | undefined;
  const providers = getProviders().filter((provider) => !providerFilter || provider.name.toLowerCase() === providerFilter.toLowerCase());
  const samples = SAMPLE_TITLES.filter((sample) => !laneFilter || sample.lane === laneFilter);
  const probes: SourceQualityProbe[] = [];

  console.log(`# Source Quality Comparison (${new Date().toISOString()})`);
  console.log(`Providers: ${providers.map((provider) => provider.name).join(", ")}`);
  console.log(`Samples: ${samples.length}`);

  for (const sample of samples) {
    for (const provider of providers) {
      const probe = await probeProvider(provider, sample);
      probes.push(probe);
      console.error(`[source-quality] ${sample.query} / ${provider.name}: ${probe.matchedTitle ?? probe.accessIssue ?? "no result"}`);
    }
  }

  printRanking(probes);
  printEvidence(probes);
}

main().catch((error) => {
  console.error("[source-quality] Comparison failed", error);
  process.exit(1);
});
