import { prisma } from "../src/lib/db";

async function main() {
    console.log("Cleaning up malformed coverUrls...");
    try {
        const result = await prisma.manga.updateMany({
            where: {
                coverUrl: {
                    contains: "undefined"
                }
            },
            data: {
                coverUrl: null
            }
        });
        console.log(`Cleaned up ${result.count} manga entries.`);
    } catch (e) {
        console.error("Cleanup failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
