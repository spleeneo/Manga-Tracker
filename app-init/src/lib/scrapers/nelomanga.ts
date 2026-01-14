import { ScrapedChapter, Scraper, MangaMetadata, SearchResult } from "./types";
import { NELOMANGA_COOKIE, NELOMANGA_USER_AGENT, NELOMANGA_BASE } from "./nelomanga-config";

export class NeloMangaScraper implements Scraper {
    name = "NeloManga";

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

    async fetchChapters(url: string): Promise<ScrapedChapter[]> {
        const slug = this.extractSlug(url);
        if (!slug) throw new Error("Could not extract manga slug from URL");

        console.log(`[NeloManga] Fetching chapters via API for: ${slug}`);
        const apiUrl = `${NELOMANGA_BASE}/api/manga/${slug}/chapters`;

        const res = await fetch(apiUrl, { headers: this.getHeaders() });
        if (!res.ok) {
            console.error(`[NeloManga] API chapters failed: ${res.status}`);
            // Fallback to HTML scraping if API fails
            return this.fetchChaptersFromHtml(url);
        }

        try {
            const result = await res.json();
            if (!result.success || !result.data?.chapters) {
                return this.fetchChaptersFromHtml(url);
            }

            return result.data.chapters.map((ch: any) => ({
                url: `https://www.nelomanga.net/manga/${slug}/${ch.chapter_slug}`,
                chapterNumber: ch.chapter_num,
                title: ch.chapter_name,
                releaseDate: ch.updated_at ? new Date(ch.updated_at) : new Date(),
            }));
        } catch (e) {
            console.error("[NeloManga] Failed to parse chapters API", e);
            return this.fetchChaptersFromHtml(url);
        }
    }

    private async fetchChaptersFromHtml(url: string): Promise<ScrapedChapter[]> {
        console.log(`[NeloManga] Falling back to HTML chapters for: ${url}`);
        const res = await fetch(url, { headers: this.getHeaders() });
        if (!res.ok) throw new Error(`Failed to fetch NeloManga page: ${res.status}`);
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
        const res = await fetch(url, { headers: this.getHeaders() });
        if (!res.ok) throw new Error(`Failed to fetch NeloManga metadata: ${res.status}`);
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
            description: descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').replace(/summary:/i, '').replace(/One Piece summary:/i, '').trim().substring(0, 500) : "",
            coverUrl,
            status: "ONGOING",
        };

        console.log(`[NeloManga] Fetched metadata for: ${metadata.title}`);
        return metadata;
    }

    async search(query: string): Promise<SearchResult[]> {
        const slug = query.replace(/\s+/g, '_').toLowerCase();
        const searchUrl = `https://www.nelomanga.net/home/search/json?searchword=${encodeURIComponent(slug)}`;

        try {
            const res = await fetch(searchUrl, { headers: this.getHeaders() });

            if (!res.ok) {
                console.error(`[NeloManga] Search failed: ${res.status}`);
                return [];
            }

            const data = await res.json();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return data.map((manga: any) => ({
                title: manga.name || "Unknown",
                sourceUrl: manga.url || `${NELOMANGA_BASE}/manga/${manga.slug || manga.id}`,
                coverUrl: manga.thumb,
                sourceName: "NeloManga",
                status: "ONGOING",
                description: `Latest: ${manga.chapterLatest || "Unknown"}`
            }));
        } catch (e) {
            console.error("[NeloManga] Search parse error", e);
            return [];
        }
    }
}

