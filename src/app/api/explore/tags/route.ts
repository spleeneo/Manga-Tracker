import { NextResponse } from "next/server";
import { getExploreTags } from "@/lib/explore/mangadex";
import { getCurrentUserId } from "@/lib/session";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const tags = await getExploreTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Explore tags API error:", error);
    return NextResponse.json({ error: "Failed to load explore filters" }, { status: 502 });
  }
}
