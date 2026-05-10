import { prisma } from "@/lib/db";
import {
  CHAT_HISTORY_LIMIT,
  CHAT_MAX_BODY_LENGTH,
  isValidChatImageUrl,
  normalizeChatBody,
  publishChatMessage,
  serializeChatMessage,
} from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const messages = await prisma.chatMessage.findMany({
    take: CHAT_HISTORY_LIMIT,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  return NextResponse.json({
    messages: messages.reverse().map(serializeChatMessage),
  });
}

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = normalizeChatBody((payload as { body?: unknown }).body);
  if (body && body.length > CHAT_MAX_BODY_LENGTH) {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  const imageUrl = (payload as { imageUrl?: unknown }).imageUrl;
  const imageName = (payload as { imageName?: unknown }).imageName;
  const imageMime = (payload as { imageMime?: unknown }).imageMime;
  const imageSize = (payload as { imageSize?: unknown }).imageSize;
  const hasImage = imageUrl != null || imageName != null || imageMime != null || imageSize != null;

  if (!body && !hasImage) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }

  if (hasImage && !isValidChatImageUrl(imageUrl)) {
    return NextResponse.json({ error: "Invalid image upload" }, { status: 400 });
  }

  const created = await prisma.chatMessage.create({
    data: {
      userId,
      body,
      imageUrl: hasImage ? String(imageUrl) : null,
      imageName: typeof imageName === "string" ? imageName : null,
      imageMime: typeof imageMime === "string" ? imageMime : null,
      imageSize: typeof imageSize === "number" ? imageSize : null,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  const message = serializeChatMessage(created);
  let realtimePublished = false;
  try {
    realtimePublished = await publishChatMessage(message);
  } catch (error) {
    console.error("Chat realtime publish failed:", error);
  }

  return NextResponse.json({ message, realtimePublished });
}
