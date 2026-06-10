import { fetchWithRetry } from "./http";
import { MangaMetadata, ReaderChapterInput, ReaderPage, ReaderResult, ReaderSourceInput, ScrapedChapter, Scraper, SearchResult } from "./types";

export type SingleMangaSiteConfig = {
  sourceName: string;
  baseUrl: string;
  canonicalTitle: string;
  aliases: string[];
  status?: string;
  author?: string;
  fallbackDescription?: string;
  fallbackCoverUrl?: string;
  chapterUrlPattern: RegExp;
  chapterTitlePattern?: RegExp;
  minimumReaderPages?: number;
  verifyLatestChapterPages?: boolean;
  readerImageAllowPatterns?: RegExp[];
  readerImageDenyPatterns?: RegExp[];
};

type DiscoveryProbe = {
  config: SingleMangaSiteConfig;
  html: string;
};

export const SINGLE_MANGA_SITE_CONFIGS: SingleMangaSiteConfig[] = [
  {
    sourceName: "Witch Hat Atelier Manga",
    baseUrl: "https://witchhatateliermanga.com/",
    canonicalTitle: "Witch Hat Atelier",
    aliases: [
      "witch hat atelier",
      "tongari booshi no atorie",
      "tongari boushi no atelier",
      "tongari boshi no atelier",
      "coco",
    ],
    status: "ONGOING",
    author: "Kamome Shirahama",
    fallbackDescription: "Read Witch Hat Atelier manga online.",
    fallbackCoverUrl: "https://witchhatateliermanga.com/wp-content/uploads/2024/10/Tongari-Booshi-No-Atorie.jpg",
    chapterUrlPattern: /witch-hat-atelier-chapter-(\d+)(?:-(\d+))?/i,
    chapterTitlePattern: /chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 1,
    readerImageAllowPatterns: [/\/witch-hat-atelier\/chapter-\d+(?:\.\d+)?\/\d+\.(?:jpe?g|png|webp)(?:\?|$)/i],
    readerImageDenyPatterns: [/tongari-booshi-no-atorie/i],
  },
  {
    sourceName: "Land of the Lustrous",
    baseUrl: "https://w1.land-of-the-lustrous.online/",
    canonicalTitle: "Houseki no Kuni",
    aliases: [
      "houseki no kuni",
      "houseki",
      "land of the lustrous",
      "lustrous",
      "phosphophyllite",
    ],
    status: "COMPLETED",
    author: "Haruko Ichikawa",
    fallbackDescription: "Read Land of the Lustrous manga online in high quality.",
    fallbackCoverUrl: "https://land-of-the-lustrous.online/wp-content/uploads/2023/12/EdYT8OLU4AUmCM8.jpg",
    chapterUrlPattern: /land-of-the-lustrous-chapter-(\d+)(?:-(\d+))?/i,
    chapterTitlePattern: /chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 1,
  },
  {
    sourceName: "Bleach Live",
    baseUrl: "https://w42.bleach.live/",
    canonicalTitle: "Bleach",
    aliases: ["bleach", "bleach manga", "bleach live", "ichigo"],
    status: "COMPLETED",
    author: "Tite Kubo",
    fallbackDescription: "Read Bleach Manga Online in High Quality.",
    fallbackCoverUrl: "https://bleach.live/wp-content/uploads/2022/11/ezgif-1-2666aed46a.jpg",
    chapterUrlPattern: /bleach-chapter-(\d+)(?:-(\d+))?/i,
    chapterTitlePattern: /bleach\s*,?\s*chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 3,
  },
  {
    sourceName: "Blue Lock Manga",
    baseUrl: "https://w45.blue-lock-manga.com/",
    canonicalTitle: "Blue Lock",
    aliases: ["blue lock", "blue lock manga", "bluelock"],
    status: "ONGOING",
    author: "Muneyuki Kaneshiro",
    fallbackDescription: "Read Blue Lock manga online.",
    chapterUrlPattern: /blue-lock(?:-manga)?-chapter-(\d+)(?:-(\d+))?/i,
    chapterTitlePattern: /chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 2,
    verifyLatestChapterPages: true,
  },
  {
    sourceName: "Fire Punch",
    baseUrl: "https://firepunch.xyz/tag/chapter-0/index.html",
    canonicalTitle: "Fire Punch",
    aliases: ["fire punch", "firepunch"],
    status: "COMPLETED",
    author: "Tatsuki Fujimoto",
    fallbackDescription: "Read Fire Punch manga online.",
    chapterUrlPattern: /fire-punch-chapter-(\d+)(?:-(\d+))?/i,
    chapterTitlePattern: /chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 3,
  },
];

export const SINGLE_MANGA_SITE_SOURCE_NAMES = SINGLE_MANGA_SITE_CONFIGS.map((config) => config.sourceName.toLowerCase());

const QUICK_DISCOVERY_SHARDS = ["w45", "w42", "w1"];
const BACKGROUND_DISCOVERY_SHARDS = Array.from({ length: 60 }, (_, index) => `w${index + 1}`);
const DISCOVERY_PATTERNS: Array<{ suffix: string; tld: string }> = [
  { suffix: "-manga", tld: "com" },
  { suffix: "", tld: "online" },
  { suffix: "", tld: "live" },
  { suffix: "", tld: "com" },
  { suffix: "-manga", tld: "online" },
  { suffix: "-manga", tld: "live" },
];

const RESERVED_PROVIDER_HOSTNAMES = new Set([
  "api.mangadex.org",
  "mangadex.org",
  "mangaplus.shueisha.co.jp",
  "viz.com",
  "webtoons.com",
  "atsu.moe",
  "manganato.com",
  "chapmanganato.to",
  "nelomanga.net",
  "mangapill.com",
]);

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeValue(value: string) {
  return decodeHtml(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTitleCase(value: string) {
  return normalizeValue(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugifyTitle(value: string) {
  return normalizeValue(value).replace(/\s+/g, "-");
}

function getTitleHintFromSource(source?: ReaderSourceInput | null) {
  if (!source?.sourceName) return "";
  return source.sourceName.replace(/\s+Manga$/i, "");
}

function getMeaningfulTokens(value: string) {
  return normalizeValue(value)
    .split(" ")
    .filter((token) => token.length > 2 && !["manga", "the", "and"].includes(token));
}

function getMeta(html: string, key: string): string | undefined {
  const match = html.match(new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function getAttribute(tag: string, attribute: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${attribute}=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function getImageAttribute(tag: string): string | undefined {
  return getAttribute(tag, "data-lazy-src")
    ?? getAttribute(tag, "data-src")
    ?? getAttribute(tag, "src");
}

function parseChapterNumber(value: string, config: SingleMangaSiteConfig): number | null {
  const match = value.match(config.chapterUrlPattern) ?? (config.chapterTitlePattern ? value.match(config.chapterTitlePattern) : null);
  if (!match) return null;

  const chapterNumber = Number(match[2] ? `${match[1]}.${match[2]}` : match[1]);
  return Number.isFinite(chapterNumber) ? chapterNumber : null;
}

function buildChapterPatternFromSlugs(slugs: string[]) {
  const escapedSlugs = Array.from(new Set(slugs.map((slug) => slug.replace(/-manga$/i, "")).filter(Boolean)))
    .map(escapeRegExp)
    .join("|");
  return new RegExp(`(?:${escapedSlugs})(?:-manga)?-chapter-(\\d+)(?:-(\\d+))?`, "i");
}

function buildDiscoveredConfig(baseUrl: string, titleHint: string): SingleMangaSiteConfig | null {
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }

  const domainParts = hostname.split(".");
  const isShardedDomain = domainParts.length >= 3 && /^w\d+$/.test(domainParts[0]);
  const isDirectDomain = domainParts.length >= 2;
  if (!isShardedDomain && !isDirectDomain) return null;

  const domainSlug = (isShardedDomain ? domainParts.slice(1, -1) : domainParts.slice(0, -1)).join("-").replace(/-manga$/i, "");
  if (!domainSlug || domainSlug.length < 3) return null;

  const canonicalTitle = toTitleCase(titleHint || domainSlug).replace(/\s+Manga$/i, "");
  const titleSlug = slugifyTitle(canonicalTitle);
  return {
    sourceName: `${canonicalTitle} Manga`,
    baseUrl,
    canonicalTitle,
    aliases: [canonicalTitle, domainSlug.replace(/-/g, " ")],
    fallbackDescription: `Read ${canonicalTitle} manga online.`,
    chapterUrlPattern: buildChapterPatternFromSlugs([domainSlug, titleSlug]),
    chapterTitlePattern: /chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 3,
  };
}

function uniqueByChapterNumber(chapters: ScrapedChapter[]): ScrapedChapter[] {
  const seen = new Set<number>();
  const unique: ScrapedChapter[] = [];

  for (const chapter of chapters) {
    if (seen.has(chapter.chapterNumber)) continue;
    seen.add(chapter.chapterNumber);
    unique.push(chapter);
  }

  return unique;
}

function getNumericAttribute(tag: string, attribute: string): number | null {
  const value = Number(getAttribute(tag, attribute));
  return Number.isFinite(value) ? value : null;
}

function hasReaderSizedDimensions(tag: string) {
  const width = getNumericAttribute(tag, "width") ?? getNumericAttribute(tag, "data-original-width");
  const height = getNumericAttribute(tag, "height") ?? getNumericAttribute(tag, "data-original-height");
  if (width == null || height == null) return false;

  return Math.max(width, height) >= 900 && Math.min(width, height) >= 450;
}

function looksLikeNumberedPage(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /(?:^|\/)(?:page[-_]?|p[-_]?)?\d{1,4}\.(?:jpe?g|png|webp)$/.test(pathname)
      || /(?:^|\/)\d{1,4}[-_]\d{1,4}\.(?:jpe?g|png|webp)$/.test(pathname);
  } catch {
    return false;
  }
}

function tagLooksLikeReaderPage(tag: string, url: string) {
  const lowerTag = tag.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const hasReaderAlt = /\bchapter\b/.test(lowerTag) && /\b(?:image|page)\b/.test(lowerTag);
  const hasImageBucket = /\/(?:images|manga|chapter|chapters|comic)\//.test(lowerUrl);

  return (hasImageBucket && (hasReaderAlt || looksLikeNumberedPage(url)))
    || (looksLikeNumberedPage(url) && hasReaderSizedDimensions(tag));
}

function isKnownContentImage(tag: string, url: string, config: SingleMangaSiteConfig): boolean {
  const lower = url.toLowerCase();
  if (!/^https?:\/\//.test(lower)) return false;
  if (!/\.(?:jpe?g|png|webp)(?:\?|$)/.test(lower)) return false;
  if (lower.includes("logo") || lower.includes("avatar") || lower.includes("emoji")) return false;
  if (lower.includes("/wp-content/themes/") || lower.includes("/wp-includes/")) return false;
  if (config.readerImageDenyPatterns?.some((pattern) => pattern.test(url))) return false;
  if (config.readerImageAllowPatterns?.length) {
    return config.readerImageAllowPatterns.some((pattern) => pattern.test(url));
  }
  return lower.includes("/wp-content/uploads/")
    || lower.includes("blogger.googleusercontent.com/img/")
    || tagLooksLikeReaderPage(tag, url);
}

function generateDiscoveryCandidates(query: string, wide = false) {
  const slug = slugifyTitle(query);
  if (!slug || slug.length < 3) return [];

  const urls = new Set<string>();
  const shards = wide ? BACKGROUND_DISCOVERY_SHARDS : QUICK_DISCOVERY_SHARDS;
  for (const shard of shards) {
    for (const pattern of DISCOVERY_PATTERNS) {
      urls.add(`https://${shard}.${slug}${pattern.suffix}.${pattern.tld}/`);
    }
  }

  if (wide) {
    const compactSlug = slug.replace(/-/g, "");
    for (const directSlug of new Set([slug, compactSlug])) {
      urls.add(`https://${directSlug}.xyz/tag/chapter-0/index.html`);
      urls.add(`https://${directSlug}.xyz/`);
    }
  }

  return Array.from(urls).slice(0, wide ? 364 : 12);
}

function htmlLooksLikeTitle(html: string, query: string) {
  const tokens = getMeaningfulTokens(query);
  if (tokens.length === 0) return false;

  const haystack = normalizeValue([
    getMeta(html, "og:title"),
    getMeta(html, "twitter:title"),
    getMeta(html, "description"),
    getMeta(html, "og:description"),
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
  ].filter(Boolean).join(" "));

  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  return matchedTokens.length >= Math.min(tokens.length, 2);
}

function htmlHasChapterLinks(html: string, config: SingleMangaSiteConfig) {
  return Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .some((match) => parseChapterNumber(`${match[1]} ${decodeHtml(match[2])}`, config) != null);
}

export class SingleMangaSiteScraper implements Scraper {
  name = "Single Manga Sites";
  capabilities = { search: true, metadata: true, chapters: true, reader: true };

  canHandle(url: string): boolean {
    return Boolean(this.findConfigByUrl(url));
  }

  private findConfigByUrl(url: string, titleHint = ""): SingleMangaSiteConfig | undefined {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      const configured = SINGLE_MANGA_SITE_CONFIGS.find((config) => new URL(config.baseUrl).hostname.replace(/^www\./, "").toLowerCase() === hostname);
      if (configured) return configured;
      if (RESERVED_PROVIDER_HOSTNAMES.has(hostname)) return undefined;
      return buildDiscoveredConfig(new URL("/", url).toString(), titleHint || hostname.split(".").slice(1, -1).join(" ")) ?? undefined;
    } catch {
      return SINGLE_MANGA_SITE_CONFIGS.find((config) => url.toLowerCase().includes(config.baseUrl.toLowerCase()));
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await fetchWithRetry(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml",
      },
      timeoutMs: 10_000,
      retries: 1,
    });

    return response.text();
  }

  async search(query: string): Promise<SearchResult[]> {
    const normalizedQuery = normalizeValue(query);
    if (!normalizedQuery) return [];

    const matchedConfigs = SINGLE_MANGA_SITE_CONFIGS.filter((config) => (
      config.aliases.some((alias) => {
        const normalizedAlias = normalizeValue(alias);
        return normalizedAlias.includes(normalizedQuery) || normalizedQuery.includes(normalizedAlias);
      })
    ));

    const configuredResults = await Promise.all(matchedConfigs.map(async (config) => {
      try {
        const metadata = await this.fetchMetadata(config.baseUrl);
        return {
          title: metadata.title,
          description: metadata.description,
          coverUrl: metadata.coverUrl,
          status: metadata.status,
          author: metadata.author,
          sourceUrl: config.baseUrl,
          sourceName: config.sourceName,
        };
      } catch {
        return {
          title: config.canonicalTitle,
          description: config.fallbackDescription,
          coverUrl: config.fallbackCoverUrl,
          status: config.status,
          author: config.author,
          sourceUrl: config.baseUrl,
          sourceName: config.sourceName,
        };
      }
    }));

    if (configuredResults.length > 0) return configuredResults;

    const discovered = await this.discoverCandidateSites(query, { wide: false });
    return discovered.map(({ config, html }) => ({
      title: config.canonicalTitle,
      description: getMeta(html, "description") ?? getMeta(html, "og:description") ?? config.fallbackDescription,
      coverUrl: getMeta(html, "twitter:image") ?? getMeta(html, "og:image") ?? config.fallbackCoverUrl,
      status: config.status,
      author: config.author,
      sourceUrl: config.baseUrl,
      sourceName: config.sourceName,
    }));
  }

  private async discoverCandidateSites(query: string, { wide }: { wide: boolean }): Promise<DiscoveryProbe[]> {
    const candidates = generateDiscoveryCandidates(query, wide);
    const probes = await Promise.all(candidates.map(async (url): Promise<DiscoveryProbe | null> => {
      const config = buildDiscoveredConfig(url, query);
      if (!config) return null;

      try {
        const response = await fetchWithRetry(url, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html,application/xhtml+xml",
          },
          timeoutMs: wide ? 1_500 : 2_500,
          retries: 0,
        });
        const html = await response.text();

        if (!htmlLooksLikeTitle(html, query)) return null;
        if (!htmlHasChapterLinks(html, config)) return null;

        return { config, html };
      } catch {
        return null;
      }
    }));

    const seenHosts = new Set<string>();
    return probes
      .filter((probe): probe is DiscoveryProbe => Boolean(probe))
      .filter((probe) => {
        const host = new URL(probe.config.baseUrl).hostname;
        if (seenHosts.has(host)) return false;
        seenHosts.add(host);
        return true;
      })
      .slice(0, 3);
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const config = this.findConfigByUrl(url);
    if (!config) throw new Error(`No single-manga site config found for URL: ${url}`);

    const html = await this.fetchHtml(url);
    return {
      title: config.canonicalTitle,
      description: getMeta(html, "description") ?? getMeta(html, "og:description") ?? config.fallbackDescription,
      coverUrl: getMeta(html, "twitter:image") ?? getMeta(html, "og:image") ?? config.fallbackCoverUrl,
      status: config.status,
      author: config.author,
    };
  }

  async fetchChapters(url: string, source?: ReaderSourceInput): Promise<ScrapedChapter[]> {
    const config = this.findConfigByUrl(url, getTitleHintFromSource(source));
    if (!config) throw new Error(`No single-manga site config found for URL: ${url}`);

    const html = await this.fetchHtml(url);
    const linkMatches = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    const chapters = linkMatches.flatMap((match) => {
      const href = match[1];
      const text = decodeHtml(match[2]);
      const chapterNumber = parseChapterNumber(href, config) ?? parseChapterNumber(text, config);
      if (chapterNumber == null) return [];

      return [{
        providerChapterId: String(chapterNumber),
        chapterNumber,
        title: text || `${config.canonicalTitle} Chapter ${chapterNumber}`,
        url: new URL(href, config.baseUrl).toString(),
      }];
    });

    const sortedChapters = uniqueByChapterNumber(chapters).sort((a, b) => b.chapterNumber - a.chapterNumber);
    if (!config.verifyLatestChapterPages || sortedChapters.length === 0) return sortedChapters;

    const [latestChapter, ...remainingChapters] = sortedChapters;
    try {
      const reader = await this.fetchReaderPages({
        id: latestChapter.providerChapterId ?? String(latestChapter.chapterNumber),
        url: latestChapter.url,
        chapterNumber: latestChapter.chapterNumber,
      }, source);

      return reader.status === "READABLE" ? sortedChapters : remainingChapters;
    } catch {
      return sortedChapters;
    }
  }

  async fetchReaderPages(chapter: ReaderChapterInput, source?: ReaderSourceInput): Promise<ReaderResult> {
    const config = this.findConfigByUrl(chapter.url, getTitleHintFromSource(source));
    if (!config) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: "This single-manga source is not configured for the Mangateo reader.",
      };
    }

    const html = await this.fetchHtml(chapter.url);
    const pages = Array.from(html.matchAll(/<img\b[^>]*>/gi))
      .map((match) => {
        const tag = match[0];
        const imageUrl = getImageAttribute(tag);
        if (!imageUrl) return null;

        const absoluteUrl = new URL(imageUrl, config.baseUrl).toString();
        if (!isKnownContentImage(tag, absoluteUrl, config)) return null;

        const width = getNumericAttribute(tag, "width") ?? undefined;
        const height = getNumericAttribute(tag, "height") ?? undefined;
        const page: ReaderPage = {
          index: 0,
          imageUrl: absoluteUrl,
        };
        if (width) page.width = width;
        if (height) page.height = height;

        return page;
      })
      .filter((page): page is ReaderPage => Boolean(page))
      .map((page, index) => ({ ...page, index }));

    const uniquePages = pages.filter((page, index, allPages) => (
      allPages.findIndex((candidate) => candidate.imageUrl === page.imageUrl) === index
    ));

    if (uniquePages.length < (config.minimumReaderPages ?? 1)) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: `${config.sourceName} did not expose readable public page images for this chapter.`,
      };
    }

    return {
      status: "READABLE",
      pages: uniquePages.map((page, index) => ({ ...page, index })),
      externalUrl: chapter.url,
    };
  }

  async discoverBackgroundSources(query: string): Promise<SearchResult[]> {
    const configured = await this.search(query);
    if (configured.length > 0) return configured;

    const discovered = await this.discoverCandidateSites(query, { wide: true });
    return discovered.map(({ config, html }) => ({
      title: config.canonicalTitle,
      description: getMeta(html, "description") ?? getMeta(html, "og:description") ?? config.fallbackDescription,
      coverUrl: getMeta(html, "twitter:image") ?? getMeta(html, "og:image") ?? config.fallbackCoverUrl,
      status: config.status,
      author: config.author,
      sourceUrl: config.baseUrl,
      sourceName: config.sourceName,
    }));
  }
}

export async function discoverSingleMangaSiteSources(query: string): Promise<SearchResult[]> {
  return new SingleMangaSiteScraper().discoverBackgroundSources(query);
}
