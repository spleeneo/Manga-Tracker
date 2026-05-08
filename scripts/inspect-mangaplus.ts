import fs from "node:fs";

async function main() {
    const endpoints = [
        "https://jumpg-webapi.tokyo-cdn.com/api/title_list/allV2",
        "https://jumpg-webapi.tokyo-cdn.com/api/title_detailV3?title_id=100020"
    ];

    let log = "";

    for (const url of endpoints) {
        log += `\nTesting ${url}...\n`;
        try {
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    "Accept": "application/json, text/plain, */*"
                }
            });
            const buffer = await res.arrayBuffer();
            const firstBytes = Buffer.from(buffer).slice(0, 100);

            log += `Status: ${res.status}\n`;
            log += `Content-Type: ${res.headers.get("content-type")}\n`;
            log += `First 100 bytes (hex): ${firstBytes.toString('hex')}\n`;
            log += `String preview: ${firstBytes.toString('utf-8')}\n`;

        } catch (e) {
            log += `Failed: ${e}\n`;
        }
    }

    fs.writeFileSync('mangaplus-debug.txt', log);
    console.log("Written to mangaplus-debug.txt");
}

main();
