import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-server";
import { isRetryableSync } from "@/lib/admin";
import { enqueueMangaSyncJob, processSyncJobs } from "@/lib/sync-jobs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAdminActor();
  if (!actor.user) return NextResponse.json({ error: actor.status === 401 ? "Authentication required" : "Administrator access required" }, { status: actor.status });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.userMangaIds !== undefined && (!Array.isArray(body.userMangaIds) || body.userMangaIds.some((value: unknown) => typeof value !== "string"))) {
    return NextResponse.json({ error: "userMangaIds must be an array of strings" }, { status: 400 });
  }
  if (!await prisma.user.findUnique({ where: { id }, select: { id: true } })) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const library = await prisma.userManga.findMany({
    where: { userId: id, ...(body.userMangaIds ? { id: { in: body.userMangaIds } } : {}) },
    select: { id: true, mangaId: true, syncStatus: true, syncStartedAt: true, manga: { select: { status: true } } },
  });
  const requested = new Set<string>(body.userMangaIds ?? []);
  if (requested.size && library.length !== requested.size) return NextResponse.json({ error: "One or more library entries were not found for this account" }, { status: 404 });
  const eligible = library.filter((item) => item.manga.status !== "COMPLETED" && isRetryableSync(item));
  const jobs = [];
  for (const item of eligible) jobs.push(await enqueueMangaSyncJob(id, item.mangaId));
  const processed = await processSyncJobs(jobs.map((job) => job.id), { concurrency: 4 });
  return NextResponse.json({ queued: jobs.length, skipped: library.length - eligible.length, jobs, processing: processed });
}
