import { checkForUpdates } from "../src/lib/manga-updater";
import { prisma } from "../src/lib/db";

async function main() {
  console.log("[smoke] Running update smoke check");
  try {
    const oneOngoing = await prisma.manga.findFirst({
      where: { status: "ONGOING" },
      select: { id: true, title: true },
    });

    if (!oneOngoing) {
      console.log("[smoke] No ongoing manga found; smoke check skipped.");
      return;
    }

    const results = await checkForUpdates(oneOngoing.id);
    console.log("[smoke] Update result", results);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[smoke] Update smoke check failed", error);
  process.exit(1);
});
