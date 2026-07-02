import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { DEFAULT_ALLOWED_CONTENT_RATINGS, DEFAULT_BLOCKED_TAG_NAMES } from "@/lib/parental-controls";

const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const normalizeList = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean))] : null;

async function requireParent(userId: string) {
  const childLink = await prisma.parentChildLink.findUnique({ where: { childId: userId }, select: { status: true } });
  return childLink?.status === "ACTIVE" ? null : userId;
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await requireParent(userId)) return NextResponse.json({ error: "Child accounts cannot manage parental controls" }, { status: 403 });
  const children = await prisma.parentChildLink.findMany({
    where: { parentId: userId },
    orderBy: { createdAt: "asc" },
    include: {
      child: { select: {
        name: true, email: true, childPolicy: true,
        library: { select: { manga: { select: { id: true, title: true, contentRating: true, classificationSource: true, tags: { select: { tag: { select: { name: true } } } } } } } },
        childOverrides: { select: { mangaId: true, decision: true } },
      } },
    },
  });
  return NextResponse.json({ children: children.map((link) => ({
    id: link.id, childId: link.childId, email: link.child?.email ?? link.childEmail,
    name: link.child?.name, status: link.status,
    policy: link.child?.childPolicy ?? { enabled: true, allowedContentRatings: DEFAULT_ALLOWED_CONTENT_RATINGS, blockedTagNames: DEFAULT_BLOCKED_TAG_NAMES },
    titles: link.child?.library.map(({ manga }) => ({ ...manga, tags: manga.tags.map(({ tag }) => tag.name, ), decision: link.child?.childOverrides.find((item) => item.mangaId === manga.id)?.decision ?? null })) ?? [],
  })) });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await requireParent(userId)) return NextResponse.json({ error: "Child accounts cannot manage parental controls" }, { status: 403 });
  const body = await request.json();
  const childEmail = normalizeEmail(body.email);
  if (!childEmail || !childEmail.includes("@")) return NextResponse.json({ error: "A valid child email is required" }, { status: 400 });
  const parent = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (parent?.email?.toLowerCase() === childEmail) return NextResponse.json({ error: "You cannot invite your own account" }, { status: 400 });
  const existing = await prisma.parentChildLink.findUnique({ where: { childEmail } });
  if (existing) return NextResponse.json({ error: "This account already has a parent invitation" }, { status: 409 });
  const child = await prisma.user.findUnique({ where: { email: childEmail }, select: { id: true } });
  const link = await prisma.parentChildLink.create({ data: { parentId: userId, childEmail, childId: child?.id, status: child ? "ACTIVE" : "PENDING" } });
  if (child) await prisma.childPolicy.upsert({ where: { childId: child.id }, update: {}, create: { childId: child.id } });
  return NextResponse.json({ id: link.id, status: link.status }, { status: 201 });
}

export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!await requireParent(userId)) return NextResponse.json({ error: "Child accounts cannot manage parental controls" }, { status: 403 });
  const body = await request.json();
  const link = await prisma.parentChildLink.findFirst({ where: { id: body.linkId, parentId: userId } });
  if (!link?.childId) return NextResponse.json({ error: "Active linked child not found" }, { status: 404 });
  const allowedContentRatings = normalizeList(body.allowedContentRatings);
  const blockedTagNames = normalizeList(body.blockedTagNames);
  if (!allowedContentRatings?.length || !blockedTagNames) return NextResponse.json({ error: "Invalid policy" }, { status: 400 });
  const policy = await prisma.childPolicy.upsert({
    where: { childId: link.childId },
    update: { enabled: body.enabled !== false, allowedContentRatings, blockedTagNames },
    create: { childId: link.childId, enabled: body.enabled !== false, allowedContentRatings, blockedTagNames },
  });
  return NextResponse.json({ policy });
}

export async function DELETE(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { linkId } = await request.json();
  const link = await prisma.parentChildLink.findFirst({ where: { id: linkId, parentId: userId } });
  if (!link) return NextResponse.json({ error: "Child link not found" }, { status: 404 });
  await prisma.$transaction([
    ...(link.childId ? [
      prisma.childMangaOverride.deleteMany({ where: { childId: link.childId } }),
      prisma.childPolicy.deleteMany({ where: { childId: link.childId } }),
    ] : []),
    prisma.parentChildLink.delete({ where: { id: link.id } }),
  ]);
  return new Response(null, { status: 204 });
}
