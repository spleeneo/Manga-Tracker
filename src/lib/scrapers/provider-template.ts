import { fetchWithRetry, ScraperRequestError } from "./http";
import { MangaMetadata, ScrapedChapter, Scraper, SearchResult } from "./types";

// Copy this class into a new `<provider>.ts` file when onboarding a source.
export class ProviderTemplateScraper implements Scraper {
  name = "ProviderTemplate";
  capabilities = { search: true, metadata: true, chapters: true };

  canHandle(url: string): boolean {
    return url.includes("example-provider.com");
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const response = await fetchWithRetry(`https://example-provider.com/search?q=${encodeURIComponent(query)}`);
      const html = await response.text();
      void html;
      return [];
    } catch (error) {
      if (error instanceof ScraperRequestError) {
        console.error(`[${this.name}] Search failed (${error.kind})`);
      }
      return [];
    }
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const response = await fetchWithRetry(url);
    const html = await response.text();
    void html;

    return {
      title: "TODO",
      status: "ONGOING",
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    const response = await fetchWithRetry(url);
    const html = await response.text();
    void html;

    return [];
  }
}
