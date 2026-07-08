import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const actor = await getAdminActor();
  if (!actor.user) return NextResponse.json({ error: actor.status === 401 ? "Authentication required" : "Administrator access required" }, { status: actor.status });
  const { id, linkId } = await params;
  const link = await prisma.parentChildLink.findFirst({ where: { id: linkId, OR: [{ parentId: id }, { childId: id }] }, select: { id: true, childId: true } });
  if (!link) return NextResponse.json({ error: "Family link not found for this account" }, { status: 404 });
  await prisma.$transaction([
    ...(link.childId ? [prisma.childMangaOverride.deleteMany({ where: { childId: link.childId } }), prisma.childPolicy.deleteMany({ where: { childId: link.childId } })] : []),
    prisma.parentChildLink.delete({ where: { id: link.id } }),
  ]);
  return NextResponse.json({ unlinked: true });
}
