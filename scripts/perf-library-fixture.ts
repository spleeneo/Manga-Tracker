import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";

// Opt-in fixtures belong only to the fake development parent; never copy progress.
async function main() {
  const user = await prisma.user.findUnique({ where: { email: "dev-parent@mangateo.local" }, select: { id: true } });
  if (!user) throw new Error("Development parent not found");
  if (process.argv[2] === "cleanup") {
    const result = await prisma.userManga.deleteMany({ where: { userId: user.id, id: { startsWith: "perf-fixture-" } } });
    console.log(`Removed ${result.count} benchmark memberships`);
    return;
  }
  if (process.argv[2] !== "seed") throw new Error("Specify seed or cleanup");
  const sizes = await prisma.userManga.groupBy({ by: ["userId"], _count: { _all: true } });
  const largest = sizes.filter((entry) => entry.userId !== user.id).sort((a, b) => b._count._all - a._count._all)[0];
  if (!largest) throw new Error("No representative library found");
  const titles = await prisma.userManga.findMany({ where: { userId: largest.userId }, select: { mangaId: true } });
  const result = await prisma.userManga.createMany({ data: titles.map(({ mangaId }) => ({ id: `perf-fixture-${randomUUID()}`, userId: user.id, mangaId })), skipDuplicates: true });
  console.log(`Added ${result.count} benchmark memberships; run cleanup after measurement`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Fixture failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
