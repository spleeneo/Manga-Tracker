import { getLibraryMangaSummaries } from "@/lib/library-summary";
import { getCurrentUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const mangas = await getLibraryMangaSummaries(userId);
    return NextResponse.json({ mangas });
  } catch (error) {
    console.error("Failed to load library summaries:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
