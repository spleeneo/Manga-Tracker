import { checkForUpdates } from "../src/lib/manga-updater";
import { prisma } from "../src/lib/db";

async function main() {
    console.log("Starting manga update check...");
    try {
        const results = await checkForUpdates();
        console.table(results);
        console.log("Update check completed.");
    } catch (e) {
        console.error("Update check failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
