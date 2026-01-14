import { ScrapedChapter, Scraper, MangaMetadata, SearchResult } from "./types";

export class MangaDexScraper implements Scraper {
    name = "MangaDex";

    canHandle(url: string): boolean {
        return url.includes("mangadex.org");
    }

    private extractId(url: string): string | null {
        const match = url.match(/title\/([0-9a-fA-F-]{36})/);
        return match ? match[1] : null;
    }

    private async getCoverUrl(mangaId: string, coverRelId: string | undefined): Promise<string | undefined> {
        if (!coverRelId) return undefined;
        try {
            const res = await fetch(`https://api.mangadex.org/cover/${coverRelId}`);
            if (!res.ok) return undefined;
            const data = await res.json();
            const fileName = data.data.attributes.fileName;
            return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`;
        } catch {
            return undefined;
        }
    }

    async fetchChapters(url: string): Promise<ScrapedChapter[]> {
        const mangaId = this.extractId(url);
        if (!mangaId) throw new Error("Could not extract MangaDex ID from URL");

        const res = await fetch(`https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=100`);
        if (!res.ok) throw new Error("Failed to fetch from MangaDex API");

        const data = await res.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.data.map((item: any) => ({
            chapterNumber: parseFloat(item.attributes.chapter),
            title: item.attributes.title || `Chapter ${item.attributes.chapter}`,
            url: `https://mangadex.org/chapter/${item.id}`,
            releaseDate: new Date(item.attributes.publishAt),
        }));
    }

    async fetchMetadata(url: string): Promise<MangaMetadata> {
        const mangaId = this.extractId(url);
        if (!mangaId) throw new Error("Invalid MangaDex URL");

        const res = await fetch(`https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        if (!res.ok) throw new Error("MangaDex API error");
        const data = await res.json();
        const manga = data.data;

        const coverArt = manga.relationships.find((r: any) => r.type === "cover_art");
        const fileName = coverArt?.attributes?.fileName;
        const author = manga.relationships.find((r: any) => r.type === "author")?.attributes?.name;

        return {
            title: manga.attributes.title.en || Object.values(manga.attributes.title)[0],
            description: manga.attributes.description.en || Object.values(manga.attributes.description)[0],
            coverUrl: fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}` : undefined,
            status: manga.attributes.status?.toUpperCase(),
            author: author
        };
    }

    async search(query: string): Promise<SearchResult[]> {
        const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=5&includes[]=cover_art`);
        if (!res.ok) return [];
        const data = await res.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.data.map((manga: any) => {
            const coverArt = manga.relationships.find((r: any) => r.type === "cover_art");
            const fileName = coverArt?.attributes?.fileName;

            return {
                title: manga.attributes.title.en || Object.values(manga.attributes.title)[0],
                description: manga.attributes.description.en?.split('\n')[0],
                coverUrl: fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}` : undefined,
                status: manga.attributes.status?.toUpperCase(),
                sourceUrl: `https://mangadex.org/title/${manga.id}`,
                sourceName: "MangaDex"
            };
        });
    }
}
