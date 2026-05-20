import { NextRequest, NextResponse } from "next/server";
import { getExploreManga } from "@/lib/explore/mangadex";
import { getCurrentUserId } from "@/lib/session";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const params = request.nextUrl.searchParams;
    const data = await getExploreManga(userId, {
      sort: params.get("sort"),
      q: params.get("q"),
      includedTags: params.get("includedTags"),
      publicationDemographic: params.get("publicationDemographic"),
      status: params.get("status"),
      limit: params.get("limit"),
      offset: params.get("offset"),
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Explore API error:", error);
    return NextResponse.json({ error: "Failed to load explore results" }, { status: 502 });
  }
}
