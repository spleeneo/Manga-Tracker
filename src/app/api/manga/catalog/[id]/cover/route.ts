import { fetchMetadata } from "@/lib/scrapers/registry";
import { evaluateMangaAccess, getChildPolicy } from "@/lib/parental-controls";
import { getCurrentUserId } from "@/lib/session";

const MANGADEX_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COVER_FILE = /^[a-zA-Z0-9._-]+$/;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Not found", { status: 404 });
  const policy = await getChildPolicy(userId);
  if (!policy) return new Response("Not found", { status: 404 });

  const { id } = await params;
  const file = new URL(request.url).searchParams.get("file") ?? "";
  if (!MANGADEX_ID.test(id) || !COVER_FILE.test(file)) return new Response("Not found", { status: 404 });

  try {
    const metadata = await fetchMetadata(`https://mangadex.org/title/${id}`);
    const access = evaluateMangaAccess(policy, {
      contentRating: metadata.contentRating ?? null,
      classificationSource: metadata.classificationSource ?? null,
      tags: (metadata.tags ?? []).map((tag) => tag.name),
    });
    const metadataFile = metadata.coverUrl ? new URL(metadata.coverUrl).pathname.split("/").pop() : undefined;
    if (!access.allowed || !metadataFile || (file !== metadataFile && file !== `${metadataFile}.256.jpg`)) return new Response("Not found", { status: 404 });

    const upstream = await fetch(`https://uploads.mangadex.org/covers/${id}/${file}`, { headers: { "user-agent": "Mangateo/1.0" } });
    if (!upstream.ok) return new Response("Not found", { status: 404 });
    return new Response(await upstream.arrayBuffer(), {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
