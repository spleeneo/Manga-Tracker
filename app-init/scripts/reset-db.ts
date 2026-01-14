import { prisma } from "../src/lib/db";

async function main() {
    console.log("⚠️  RESETTING DATABASE...");

    try {
        // Delete in order to avoid foreign key constraints if cascade isn't perfect, 
        // though Cascade should handle it.
        // Deleting Manga should cascade to Chapters and Sources.

        console.log("Deleting all Manga (and cascading to Chapters/Sources)...");
        const { count } = await prisma.manga.deleteMany({});

        console.log(`✅ Database reset successful. Deleted ${count} manga entries.`);
    } catch (e) {
        console.error("❌ Reset failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
