import { getLibraryMangaSummaries } from "@/lib/library-summary";
import { getCurrentUserId } from "@/lib/session";
import { NextResponse } from "next/server";
import { getMangaAccess } from "@/lib/parental-controls";
import { getChildPolicy } from "@/lib/parental-controls";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const isChild = Boolean(await getChildPolicy(userId));
    const mangas = await getLibraryMangaSummaries(userId, isChild);
    const decisions = await Promise.all(mangas.map((manga) => getMangaAccess(userId, manga.id)));
    return NextResponse.json({ mangas: mangas.filter((_, index) => decisions[index]?.allowed) });
  } catch (error) {
    console.error("Failed to load library summaries:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
