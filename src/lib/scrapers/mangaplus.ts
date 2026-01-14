import { Scraper, SearchResult, ScrapedChapter, MangaMetadata } from "./types";
import protobuf from "protobufjs";

const API_BASE = "https://jumpg-webapi.tokyo-cdn.com/api";

const protoDefinition = `
syntax = "proto3";

message Response {
    optional SuccessResult success = 1;
}

message SuccessResult {
    optional bool isFeaturedUpdated = 1;
    optional AllTitlesView allTitlesView = 25;
    optional TitleDetailView titleDetailView = 8;
    optional TitleRankingView titleRankingView = 6;
    optional WebHomeView webHomeView = 11;
}

message AllTitlesView {
    repeated SimpleTitle titles = 1;
}

message SimpleTitle {
    optional string name = 1;
    optional string portraitImageUrl = 2;
}

message TitleDetailView {
    optional Title title = 1;
    optional string titleImageUrl = 2; 
    optional string overview = 3; 
    optional string contentWrapper = 4;
    repeated Chapter lastChapterList = 28;
}

message TitleRankingView {
    repeated Title titles = 1;
}

message WebHomeView {
    repeated Group groups = 2;
}

message Group {
    optional string groupName = 1;
    repeated Title titles = 2;
}

message Title {
    optional uint32 titleId = 1;
    optional string name = 2;
    optional string author = 3;
    optional string portraitImageUrl = 4;
    optional string landscapeImageUrl = 5;
    optional uint32 viewCount = 6;
    optional uint32 language = 7;
}

message Chapter {
    optional string chapterIdStr = 1; 
    optional ChapterDetail detail = 2;
    optional string startTimeStamp = 6; 
    optional string endTimeStamp = 7;
}

message ChapterDetail {
    optional uint32 subId = 1;
    optional string nameHeader = 3; // e.g. "#003"
    optional string subTitle = 4;   // e.g. "The Great Pirate"
    optional string thumbnail = 5;
}
`;


// Initialize the root object
const root = protobuf.parse(protoDefinition).root;
const ResponseMessage = root.lookupType("Response");

export class MangaPlusScraper implements Scraper {
    name = "MangaPlus";
    baseUrl = "https://mangaplus.shueisha.co.jp";

    canHandle(url: string): boolean {
        return url.includes("mangaplus.shueisha.co.jp");
    }

    private async fetchProto(url: string): Promise<any> {
        try {
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    "Accept": "application/json, text/plain, */*" // Sometimes helps
                }
            });

            if (!res.ok) {
                throw new Error(`MangaPlus API error: ${res.status}`);
            }

            const buffer = await res.arrayBuffer();
            const decoded = ResponseMessage.decode(new Uint8Array(buffer));
            const obj = ResponseMessage.toObject(decoded, {
                longs: String,
                enums: String,
                bytes: String,
            });
            return obj;
        } catch (e) {
            console.error("MangaPlus Proto Error:", e);
            throw e;
        }
    }

    async search(query: string): Promise<SearchResult[]> {
        const url = `${API_BASE}/title_list/allV2`;
        try {
            const data = await this.fetchProto(url);
            const titles = data.success?.allTitlesView?.titles || [];

            return titles
                .filter((t: any) => t.name && t.name.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 5) // Limit results
                .map((t: any) => {
                    let titleId = "0";
                    if (t.portraitImageUrl) {
                        const match = t.portraitImageUrl.match(/title\/(\d+)/);
                        if (match) titleId = match[1];
                    }

                    return {
                        title: t.name,
                        sourceUrl: `${this.baseUrl}/titles/${titleId}`,
                        sourceName: "MangaPlus",
                        coverUrl: t.portraitImageUrl,
                        status: "ONGOING",
                        description: "",
                    };
                });

        } catch (e) {
            console.error("MangaPlus search failed:", e);
            return [];
        }
    }

    async fetchChapters(mangaUrl: string): Promise<ScrapedChapter[]> {
        const match = mangaUrl.match(/titles\/(\d+)/);
        if (!match) return [];
        const titleId = match[1];

        const url = `${API_BASE}/title_detailV3?title_id=${titleId}`;

        try {
            const data = await this.fetchProto(url);
            const detail = data.success?.titleDetailView;

            if (!detail) return [];

            const allChapters = detail.lastChapterList || [];

            return allChapters.map((ch: any) => {
                const header = ch.detail?.nameHeader || "";
                const sub = ch.detail?.subTitle || "";
                const title = header && sub ? `${header}: ${sub}` : header || sub || `Chapter ${ch.chapterIdStr}`;
                const num = parseFloat(header.replace('#', '')) || 0;

                return {
                    chapterNumber: num,
                    title: title,
                    url: `${this.baseUrl}/viewer/${ch.chapterIdStr}`,
                    releaseDate: new Date(),
                };
            }).filter(c => c.url.includes("viewer")); // Keep all chapters even if num is 0
        } catch (e) {
            console.error("MangaPlus chapters failed:", e);
            return [];
        }
    }

    async fetchMetadata(mangaUrl: string): Promise<MangaMetadata> {
        const match = mangaUrl.match(/titles\/(\d+)/);
        if (!match) throw new Error("Invalid MangaPlus URL");
        const titleId = match[1];

        const url = `${API_BASE}/title_detailV3?title_id=${titleId}`;
        const data = await this.fetchProto(url);
        const detail = data.success?.titleDetailView;

        if (!detail || !detail.title) throw new Error("Manga not found");

        return {
            title: detail.title.name,
            coverUrl: detail.title.portraitImageUrl,
            description: detail.overview,
            status: "ONGOING",
            author: detail.title.author || ""
        };
    }
}
