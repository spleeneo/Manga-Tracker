import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminActor } from "@/lib/admin-server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAdminActor();
  if (!actor.user) return NextResponse.json({ error: actor.status === 401 ? "Authentication required" : "Administrator access required" }, { status: actor.status });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body?.role !== "USER" && body?.role !== "ADMIN") return NextResponse.json({ error: "Role must be USER or ADMIN" }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (id === actor.user.id && body.role !== target.role) return NextResponse.json({ error: "You cannot change your own administrator role" }, { status: 409 });
  if (target.role === "ADMIN" && body.role === "USER" && await prisma.user.count({ where: { role: "ADMIN" } }) <= 1) {
    return NextResponse.json({ error: "The final administrator cannot be demoted" }, { status: 409 });
  }
  const user = await prisma.user.update({ where: { id }, data: { role: body.role }, select: { id: true, role: true } });
  return NextResponse.json({ user });
}
