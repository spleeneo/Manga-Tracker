import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { getMangaAccess } from "@/lib/parental-controls";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Not found", { status: 404 });
  const { slug } = await params;
  const manga = await prisma.manga.findUnique({ where: { slug }, select: { id: true, coverUrl: true } });
  if (!manga?.coverUrl) return new Response("Not found", { status: 404 });
  const [tracked, access] = await Promise.all([
    prisma.userManga.findUnique({ where: { userId_mangaId: { userId, mangaId: manga.id } }, select: { id: true } }),
    getMangaAccess(userId, manga.id),
  ]);
  if (!tracked || !access.allowed || !access.isChild) return new Response("Not found", { status: 404 });

  try {
    const upstream = new URL(manga.coverUrl);
    const referer = upstream.hostname.endsWith("readdetectiveconan.com") ? "https://mangapill.com/" : upstream.origin;
    const response = await fetch(upstream, { headers: { "User-Agent": "Mangateo/1.0", Referer: referer } });
    if (!response.ok) return new Response("Cover unavailable", { status: 502 });
    return new Response(await response.arrayBuffer(), { headers: {
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    } });
  } catch {
    return new Response("Cover unavailable", { status: 502 });
  }
}
