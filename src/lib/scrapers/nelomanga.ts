import { ScrapedChapter, Scraper, MangaMetadata, ReaderResult, SearchResult } from "./types";
import { NELOMANGA_COOKIE, NELOMANGA_USER_AGENT, NELOMANGA_BASE } from "./nelomanga-config";
import { fetchWithRetry, ScraperRequestError } from "./http";
import { normalizeMangaStatus } from "@/lib/manga-status";
import { withProviderClassification } from "@/lib/classification-utils";

interface NeloChapterApiItem {
    chapter_slug: string;
    chapter_num: number;
    chapter_name: string;
    updated_at?: string;
}

interface NeloChapterApiResponse {
    success?: boolean;
    data?: {
        chapters?: NeloChapterApiItem[];
        pagination?: {
            limit?: number;
            offset?: number;
            has_more?: boolean;
        };
    };
}

function decodeHtml(value: string): string {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, "\"")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractStatus(html: string): string | undefined {
    return html.match(/(?:status|estado)\s*:?\s*<\/?[^>]*>\s*([^<\n]+)/i)?.[1]?.trim()
        ?? html.match(/<[^>]+class=["'][^"']*(?:status|info-status)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim();
}

const NELOMANGA_KNOWN_DUPLICATE_SEARCH_RESULTS: Record<string, SearchResult[]> = {
    noise: [
        {
            title: "Noise",
            sourceUrl: `${NELOMANGA_BASE}/manga/noise_44084`,
            coverUrl: "https://uploads.mangadex.org/covers/a1ccb58d-d225-47fa-87de-1b1678f8931a/7a316413-6ffd-4a7d-a623-ee696e46be73.jpg.256.jpg",
            sourceName: "NeloManga",
            status: "ONGOING",
            description: "Latest: Chapter 23",
        },
    ],
};

export class NeloMangaScraper implements Scraper {
    name = "NeloManga";
    capabilities = { search: true, metadata: true, chapters: true, reader: true };

    canHandle(url: string): boolean {
        return url.includes("nelomanga.net");
    }

    private getHeaders() {
        return {
            'User-Agent': NELOMANGA_USER_AGENT,
            'Cookie': NELOMANGA_COOKIE,
            'Referer': `${NELOMANGA_BASE}/`,
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
        };
    }

    private extractSlug(url: string): string | null {
        // Handle: https://www.nelomanga.net/manga/one-piece
        // Handle: https://www.nelomanga.net/manga/one-piece/chapter-1170 (should still give one-piece)
        const match = url.match(/manga\/([^/?#]+)/);
        return match ? match[1] : null;
    }

    private toAbsoluteUrl(url: string): string {
        return new URL(url.replace(/&amp;/g, "&"), NELOMANGA_BASE).toString();
    }

    private getImageSrc(tag: string): string | undefined {
        return tag.match(/\s(?:data-src|data-original|src)=["']([^"']+)["']/i)?.[1];
    }

    private isReaderImage(url: string): boolean {
        const lower = url.toLowerCase();
        if (!/^https?:\/\//.test(lower)) return false;
        if (!/\.(?:jpe?g|png|webp)(?:\?|$)/.test(lower)) return false;
        if (lower.includes("logo") || lower.includes("avatar") || lower.includes("banner") || /[/?&_-]ads?[/?&_.-]/.test(lower)) return false;
        return lower.includes("nelomanga") || lower.includes("blogspot") || lower.includes("wp-content/uploads");
    }

    async fetchChapters(url: string): Promise<ScrapedChapter[]> {
        const slug = this.extractSlug(url);
        if (!slug) throw new Error("Could not extract manga slug from URL");

        console.log(`[NeloManga] Fetching chapters via API for: ${slug}`);
        const apiUrl = `${NELOMANGA_BASE}/api/manga/${slug}/chapters`;
        const chapters: ScrapedChapter[] = [];
        const seenProviderIds = new Set<string>();
        let offset = 0;
        let pageCount = 0;

        try {
            while (pageCount < 20) {
                const pageUrl = offset === 0 ? apiUrl : `${apiUrl}?offset=${offset}`;
                const res = await fetchWithRetry(pageUrl, { headers: this.getHeaders() });
                const result = await res.json() as NeloChapterApiResponse;
                const apiChapters = result.data?.chapters;

                if (!result.success || !Array.isArray(apiChapters)) {
                    if (chapters.length > 0) break;
                    return this.fetchChaptersFromHtml(url);
                }

                for (const ch of apiChapters) {
                    if (seenProviderIds.has(ch.chapter_slug)) continue;
                    seenProviderIds.add(ch.chapter_slug);
                    chapters.push({
                        providerChapterId: ch.chapter_slug,
                        url: `https://www.nelomanga.net/manga/${slug}/${ch.chapter_slug}`,
                        chapterNumber: ch.chapter_num,
                        title: ch.chapter_name,
                        releaseDate: ch.updated_at ? new Date(ch.updated_at) : new Date(),
                    });
                }

                pageCount++;
                const pagination = result.data?.pagination;
                const hasMore = pagination?.has_more ?? apiChapters.length > 0;
                if (!hasMore || apiChapters.length === 0) break;

                const nextOffset = typeof pagination?.offset === "number" && typeof pagination?.limit === "number"
                    ? pagination.offset + pagination.limit
                    : offset + apiChapters.length;

                if (nextOffset <= offset) break;
                offset = nextOffset;
            }

            return chapters.length > 0 ? chapters : this.fetchChaptersFromHtml(url);
        } catch (e) {
            if (e instanceof ScraperRequestError) {
                console.error(`[NeloManga] API chapters failed (${e.kind})`);
            } else {
                console.error("[NeloManga] Failed to parse chapters API", e);
            }
            if (chapters.length > 0) return chapters;
            return this.fetchChaptersFromHtml(url);
        }
    }

    private async fetchChaptersFromHtml(url: string): Promise<ScrapedChapter[]> {
        console.log(`[NeloManga] Falling back to HTML chapters for: ${url}`);
        const res = await fetchWithRetry(url, { headers: this.getHeaders() });
        const html = await res.text();

        const chapters: ScrapedChapter[] = [];
        const chapterRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]+?)<\/a>/gi;
        let match;

        while ((match = chapterRegex.exec(html)) !== null) {
            const link = match[1];
            const text = match[2].replace(/<[^>]*>?/gm, '').trim();

            if (link.includes('/chapter/') || text.toLowerCase().includes('chapter')) {
                const numMatch = text.match(/([\d.]+)/);
                if (numMatch) {
                    chapters.push({
                        providerChapterId: link,
                        url: link.startsWith('http') ? link : `https://www.nelomanga.net${link}`,
                        chapterNumber: parseFloat(numMatch[1]),
                        title: text,
                        releaseDate: new Date(),
                    });
                }
            }
        }
        return chapters;
    }

    async fetchMetadata(url: string): Promise<MangaMetadata> {
        console.log(`[NeloManga] Fetching metadata for: ${url}`);
        const res = await fetchWithRetry(url, { headers: this.getHeaders() });
        const html = await res.text();

        const titleMatch = html.match(/<h1>([^<]+)<\/h1>/i);
        // Corrected selectors based on browser subagent findings (#contentBox)
        const descMatch = html.match(/id="contentBox"[\s\S]*?>([\s\S]+?)<\/div>/i) ||
            html.match(/class="contentBox"[\s\S]*?>([\s\S]+?)<\/div>/i) ||
            html.match(/class="panel-story-info-description">([\s\S]+?)<\/div>/i);

        const coverMatch = html.match(/class="manga-info-pic"[^>]*>[\s\S]*?src="([^"]+)"/i) ||
            html.match(/class="info-image"[^>]*>[\s\S]*?src="([^"]+)"/i) ||
            html.match(/class="story-info-left"[^>]*>[\s\S]*?src="([^"]+)"/i);

        let coverUrl = undefined;
        if (coverMatch && coverMatch[1]) {
            coverUrl = coverMatch[1].startsWith('http') ? coverMatch[1] : `${NELOMANGA_BASE}${coverMatch[1]}`;
        }

        const metadata = {
            title: titleMatch ? titleMatch[1].trim() : "Unknown",
            description: descMatch ? decodeHtml(descMatch[1].replace(/<[^>]*>?/gm, '').replace(/summary:/i, '').replace(/One Piece summary:/i, '')).substring(0, 500) : "",
            coverUrl,
            status: normalizeMangaStatus(extractStatus(html), "ONGOING"),
        };

        console.log(`[NeloManga] Fetched metadata for: ${metadata.title}`);
        return withProviderClassification(this.name, metadata, html);
    }

    async search(query: string): Promise<SearchResult[]> {
        const slug = query.replace(/\s+/g, '_').toLowerCase();
        const searchUrl = `https://www.nelomanga.net/home/search/json?searchword=${encodeURIComponent(slug)}`;

        try {
            const res = await fetchWithRetry(searchUrl, { headers: this.getHeaders() });

            const data = await res.json();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const results = data.map((manga: any) => ({
                title: manga.name || "Unknown",
                sourceUrl: manga.url || `${NELOMANGA_BASE}/manga/${manga.slug || manga.id}`,
                coverUrl: manga.thumb,
                sourceName: "NeloManga",
                status: "ONGOING",
                description: `Latest: ${manga.chapterLatest || "Unknown"}`
            }));

            const knownDuplicates = NELOMANGA_KNOWN_DUPLICATE_SEARCH_RESULTS[slug] ?? [];
            const existingUrls = new Set(results.map((result: SearchResult) => result.sourceUrl));
            return [
                ...results,
                ...knownDuplicates.filter((result) => !existingUrls.has(result.sourceUrl)),
            ];
        } catch (e) {
            if (e instanceof ScraperRequestError) {
                console.error(`[NeloManga] Search request failed (${e.kind})`, e);
            } else {
                console.error("[NeloManga] Search parse error", e);
            }
            return [];
        }
    }

    async fetchReaderPages(chapter: { url: string }): Promise<ReaderResult> {
        try {
            const res = await fetchWithRetry(chapter.url, {
                headers: {
                    ...this.getHeaders(),
                    "Accept": "text/html,application/xhtml+xml",
                },
                timeoutMs: 10_000,
                retries: 1,
            });
            const html = await res.text();
            const pages = Array.from(html.matchAll(/<img\b[^>]*>/gi))
                .map((match) => this.getImageSrc(match[0]))
                .filter((url): url is string => Boolean(url))
                .map((url) => this.toAbsoluteUrl(url))
                .filter((url) => this.isReaderImage(url));

            if (pages.length === 0) {
                return {
                    status: "EXTERNAL_ONLY",
                    pages: [],
                    externalUrl: chapter.url,
                    reason: "NeloManga did not expose public page images for this chapter.",
                };
            }

            return {
                status: "READABLE",
                pages: pages.map((imageUrl, index) => ({ index, imageUrl })),
                externalUrl: chapter.url,
            };
        } catch (error) {
            const isBlocked = error instanceof ScraperRequestError && error.kind === "blocked";
            return {
                status: isBlocked ? "BLOCKED" : "ERROR",
                pages: [],
                externalUrl: chapter.url,
                reason: isBlocked
                    ? "NeloManga blocked Mangateo from loading this chapter directly."
                    : "NeloManga reader pages could not be loaded.",
            };
        }
    }
}

