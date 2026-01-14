
import { MangaPlusScraper } from "../src/lib/scrapers/mangaplus";

async function main() {
    console.log("Testing MangaPlus Scraper...");
    const scraper = new MangaPlusScraper();

    try {
        console.log("Searching for 'One Piece'...");
        const results = await scraper.search("One Piece");
        console.log(`Found ${results.length} results:`);
        results.forEach(r => console.log(`- ${r.title} (${r.sourceUrl})`));

        console.log("\n--- Testing Direct Metadata Fetch (One Piece) ---");
        try {
            const onePieceUrl = "https://mangaplus.shueisha.co.jp/titles/100020";
            const meta = await scraper.fetchMetadata(onePieceUrl);
            console.log("Direct Metadata Success:", meta);
        } catch (e) {
            console.error("Direct Metadata Failed:", e);
        }

        if (results.length > 0) {
            const first = results[0];
            console.log(`\nFetching metadata for ${first.title}...`);
            const meta = await scraper.fetchMetadata(first.sourceUrl);
            console.log("Metadata:", meta);

            console.log(`\nFetching chapters for ${first.title}...`);
            const chapters = await scraper.fetchChapters(first.sourceUrl);
            console.log(`Found ${chapters.length} chapters.`);
            if (chapters.length > 0) {
                console.log("First chapter:", chapters[0]);
            }
        }
    } catch (e) {
        console.error("Test failed:", e);
    }
}

main();
