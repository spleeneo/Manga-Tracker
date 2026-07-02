import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";

export async function PUT(request: Request) {
  const parentId = await getCurrentUserId();
  if (!parentId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { childId, mangaId, decision } = await request.json();
  if (decision !== "ALLOW" && decision !== "BLOCK") return NextResponse.json({ error: "Decision must be ALLOW or BLOCK" }, { status: 400 });
  const link = await prisma.parentChildLink.findFirst({ where: { parentId, childId, status: "ACTIVE" } });
  if (!link) return NextResponse.json({ error: "Linked child not found" }, { status: 404 });
  const manga = await prisma.manga.findUnique({ where: { id: mangaId }, select: { id: true } });
  if (!manga) return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  const override = await prisma.childMangaOverride.upsert({
    where: { childId_mangaId: { childId, mangaId } }, update: { decision, grantedById: parentId },
    create: { childId, mangaId, decision, grantedById: parentId },
  });
  return NextResponse.json({ override });
}

export async function DELETE(request: Request) {
  const parentId = await getCurrentUserId();
  if (!parentId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { childId, mangaId } = await request.json();
  const link = await prisma.parentChildLink.findFirst({ where: { parentId, childId, status: "ACTIVE" } });
  if (!link) return NextResponse.json({ error: "Linked child not found" }, { status: 404 });
  await prisma.childMangaOverride.deleteMany({ where: { childId, mangaId } });
  return new Response(null, { status: 204 });
}
