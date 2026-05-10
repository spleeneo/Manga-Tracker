import { createChatTokenRequest } from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const tokenRequest = await createChatTokenRequest(userId);
  if (!tokenRequest) {
    return NextResponse.json({ error: "Ably is not configured" }, { status: 503 });
  }

  return NextResponse.json(tokenRequest);
}
