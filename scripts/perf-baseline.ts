import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/db";
import { getLibraryMangaSummaries } from "../src/lib/library-summary";
import { getSyncQueueMetrics } from "../src/lib/sync-jobs";

async function measure(label: string, fn: () => Promise<unknown>, runs = 5) {
  const samplesMs: number[] = [];
  for (let run = 0; run < runs; run++) {
    const start = performance.now();
    await fn();
    samplesMs.push(Math.round(performance.now() - start));
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  return { label, samplesMs, medianMs: sorted[Math.floor(sorted.length / 2)], minMs: sorted[0], maxMs: sorted.at(-1) };
}

async function main() {
  const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3100";
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl)) throw new Error("Benchmark a local production server only");
  const librarySizes = await prisma.userManga.groupBy({ by: ["userId"], _count: { _all: true } });
  librarySizes.sort((a, b) => a._count._all - b._count._all);
  const samples = [librarySizes[0], librarySizes.at(-1)].filter(Boolean);
  const measurements = [];
  const shapes = [];
  for (const [index, sample] of samples.entries()) {
    if (!sample) continue;
    const summaries = await getLibraryMangaSummaries(sample.userId);
    shapes.push({ label: index === 0 ? "small" : "large", titles: summaries.length, payloadBytes: Buffer.byteLength(JSON.stringify(summaries)) });
    measurements.push(await measure(`db: ${index === 0 ? "small" : "large"} library summaries`, () => getLibraryMangaSummaries(sample.userId), 7));
  }
  const http = async (path: string, cookie?: string) => {
    const res = await fetch(`${baseUrl}${path}`, { headers: cookie ? { Cookie: cookie } : undefined, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Benchmark request failed (${res.status})`);
    return res;
  };
  measurements.push(await measure("http: unauthenticated shell", async () => (await http("/")).arrayBuffer()));
  // Reuse the development test account's existing database session; never print credentials.
  const session = await prisma.session.findFirst({ where: { expires: { gt: new Date() }, user: { email: "dev-parent@mangateo.local" } }, orderBy: { expires: "desc" }, select: { sessionToken: true, userId: true } });
  const notes: string[] = [];
  if (session) {
    const cookie = `${process.env.PERF_COOKIE_NAME ?? "authjs.session-token"}=${session.sessionToken}`;
    measurements.push(await measure("http: authenticated library API", async () => (await http("/api/manga/library", cookie)).arrayBuffer()));
    measurements.push(await measure("http: uncached reported-title search", async () => (await http("/api/manga/search?q=in%20the%20name%20of%20god&retry=1", cookie)).arrayBuffer(), 3));
    const summaries = await getLibraryMangaSummaries(session.userId);
    const title = summaries.find((manga) => manga.nextUnreadChapter?.id);
    if (title?.nextUnreadChapter) {
      const readerPath = `/api/manga/${title.slug}/chapter/${title.nextUnreadChapter.id}/reader`;
      measurements.push(await measure("http: reader page discovery", async () => (await http(readerPath, cookie)).arrayBuffer(), 3));
      const reader = await (await http(readerPath, cookie)).json();
      if (reader.pages?.[0]?.imageUrl) {
        const imageUrl = reader.pages[0].imageUrl;
        const imagePath = imageUrl.startsWith("/") ? imageUrl : `/api/proxy/image?url=${encodeURIComponent(imageUrl)}`;
        measurements.push(await measure("http: first reader image transfer", async () => (await http(imagePath, cookie)).arrayBuffer(), 3));
      } else notes.push("No readable first image returned for the test library.");
    } else notes.push("No unread chapter in the test library.");
  } else notes.push("Authenticated HTTP checks skipped: no active development-parent session.");
  const eligibleTrackedTitles = await prisma.manga.count({ where: { userManga: { some: {} }, NOT: { status: "COMPLETED" } } });
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, shapes, measurements, queue: await getSyncQueueMetrics(), eligibleTrackedTitles, notes, limitations: "HTTP transfer and DB timings only. Browser readiness, layout shifts, and session memory require the browser diagnostics panel." }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Benchmark failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
