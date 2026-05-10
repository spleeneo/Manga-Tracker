import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import {
  CHAT_ALLOWED_IMAGE_TYPES,
  CHAT_MAX_IMAGE_BYTES,
} from "@/lib/chat";
import { getCurrentUserId } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Vercel Blob is not configured" }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  if (!CHAT_ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WEBP, and GIF images are allowed" }, { status: 400 });
  }

  if (file.size > CHAT_MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase()?.replace(/[^a-z0-9]/g, "") || "image";
  const blob = await put(`chat/${userId}/${randomUUID()}.${extension}`, file, {
    access: "public",
    contentType: file.type,
  });

  return NextResponse.json({
    imageUrl: blob.url,
    imageName: file.name,
    imageMime: file.type,
    imageSize: file.size,
  });
}
