import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAdminActor();
  if (!actor.user) return NextResponse.json({ error: actor.status === 401 ? "Authentication required" : "Administrator access required" }, { status: actor.status });
  const { id } = await params;
  if (id === actor.user.id) return NextResponse.json({ error: "You cannot revoke your own sessions here" }, { status: 409 });
  if (!await prisma.user.findUnique({ where: { id }, select: { id: true } })) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const result = await prisma.session.deleteMany({ where: { userId: id } });
  return NextResponse.json({ revoked: result.count });
}
