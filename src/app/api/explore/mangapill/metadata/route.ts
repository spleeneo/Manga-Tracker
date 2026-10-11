import { NextRequest, NextResponse } from "next/server";
import { canonicalMangaPillDetailUrl, getMangaPillSynopsis } from "@/lib/explore/mangapill-metadata";
import { getChildPolicy } from "@/lib/parental-controls";
import { getCurrentUserId } from "@/lib/session";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  // Children browse the permitted catalog, never arbitrary provider detail pages.
  if (await getChildPolicy(userId)) return NextResponse.json({ error: "Provider metadata is unavailable for this account" }, { status: 403 });
  let url: string;
  try { url = canonicalMangaPillDetailUrl(request.nextUrl.searchParams.get("url") ?? ""); }
  catch { return NextResponse.json({ error: "Unsupported MangaPill title URL" }, { status: 400 }); }
  try {
    return NextResponse.json(await getMangaPillSynopsis(url), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load the synopsis. Please retry." }, { status: 502 });
  }
}
