import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  chatCreateMock,
  chatFindManyMock,
  createChatTokenRequestMock,
  getCurrentUserIdMock,
  publishChatMessageMock,
  putMock,
} = vi.hoisted(() => ({
  chatCreateMock: vi.fn(),
  chatFindManyMock: vi.fn(),
  createChatTokenRequestMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  publishChatMessageMock: vi.fn(),
  putMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    chatMessage: {
      create: chatCreateMock,
      findMany: chatFindManyMock,
    },
  },
}));

vi.mock("@/lib/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chat")>();
  return {
    ...actual,
    createChatTokenRequest: createChatTokenRequestMock,
    publishChatMessage: publishChatMessageMock,
  };
});

vi.mock("@vercel/blob", () => ({
  put: putMock,
}));

import { GET as getToken } from "@/app/api/chat/ably-token/route";
import { GET as getMessages, POST as postMessage } from "@/app/api/chat/messages/route";
import { POST as uploadImage } from "@/app/api/chat/upload/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/chat/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function chatRecord(id: string, createdAt: string, body = `Message ${id}`) {
  return {
    id,
    body,
    imageUrl: null,
    imageName: null,
    imageMime: null,
    imageSize: null,
    createdAt: new Date(createdAt),
    user: {
      id: "u1",
      name: "Matéo",
      email: "mateo@example.com",
      image: null,
    },
  };
}

describe("chat messages API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    publishChatMessageMock.mockResolvedValue(true);
  });

  it("requires authentication for history", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await getMessages();

    expect(res.status).toBe(401);
    expect(chatFindManyMock).not.toHaveBeenCalled();
  });

  it("returns the latest 100 messages in ascending display order", async () => {
    chatFindManyMock.mockResolvedValue([
      chatRecord("new", "2026-01-02T00:00:00.000Z"),
      chatRecord("old", "2026-01-01T00:00:00.000Z"),
    ]);

    const res = await getMessages();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(chatFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      orderBy: { createdAt: "desc" },
    }));
    expect(body.messages.map((message: { id: string }) => message.id)).toEqual(["old", "new"]);
  });

  it("rejects unauthenticated message creation", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await postMessage(jsonRequest({ body: "hello" }) as never);

    expect(res.status).toBe(401);
    expect(chatCreateMock).not.toHaveBeenCalled();
  });

  it("rejects empty, long, and invalid image messages", async () => {
    const empty = await postMessage(jsonRequest({ body: "   " }) as never);
    const tooLong = await postMessage(jsonRequest({ body: "x".repeat(1001) }) as never);
    const badImage = await postMessage(jsonRequest({ imageUrl: "blob:local-preview" }) as never);

    expect(empty.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(badImage.status).toBe(400);
    expect(chatCreateMock).not.toHaveBeenCalled();
  });

  it("creates and publishes a valid message", async () => {
    chatCreateMock.mockResolvedValue(chatRecord("m1", "2026-01-01T00:00:00.000Z", "hello"));

    const res = await postMessage(jsonRequest({ body: " hello " }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(chatCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u1", body: "hello" }),
    }));
    expect(publishChatMessageMock).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }));
    expect(body.message.id).toBe("m1");
  });
});

describe("chat token API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await getToken();

    expect(res.status).toBe(401);
  });

  it("returns setup error when Ably is not configured", async () => {
    createChatTokenRequestMock.mockResolvedValue(null);

    const res = await getToken();

    expect(res.status).toBe(503);
  });

  it("returns an Ably token request", async () => {
    createChatTokenRequestMock.mockResolvedValue({ keyName: "app.key", nonce: "n" });

    const res = await getToken();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(createChatTokenRequestMock).toHaveBeenCalledWith("u1");
    expect(body.keyName).toBe("app.key");
  });
});

describe("chat image upload API", () => {
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token";
    getCurrentUserIdMock.mockResolvedValue("u1");
    putMock.mockResolvedValue({ url: "https://blob.vercel-storage.com/chat/u1/image.png" });
  });

  afterEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);
    const form = new FormData();
    form.set("file", new File(["x"], "x.png", { type: "image/png" }));

    const res = await uploadImage(new Request("http://localhost/api/chat/upload", { method: "POST", body: form }) as never);

    expect(res.status).toBe(401);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("rejects invalid file types and files over 5 MB", async () => {
    const badType = new FormData();
    badType.set("file", new File(["x"], "x.txt", { type: "text/plain" }));
    const tooLarge = new FormData();
    tooLarge.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.png", { type: "image/png" }));

    const badTypeRes = await uploadImage(new Request("http://localhost/api/chat/upload", { method: "POST", body: badType }) as never);
    const tooLargeRes = await uploadImage(new Request("http://localhost/api/chat/upload", { method: "POST", body: tooLarge }) as never);

    expect(badTypeRes.status).toBe(400);
    expect(tooLargeRes.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("uploads valid images to Vercel Blob", async () => {
    const form = new FormData();
    form.set("file", new File(["image"], "panel.png", { type: "image/png" }));

    const res = await uploadImage(new Request("http://localhost/api/chat/upload", { method: "POST", body: form }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(putMock).toHaveBeenCalledWith(expect.stringMatching(/^chat\/u1\/.+\.png$/), expect.any(File), expect.objectContaining({
      access: "public",
      contentType: "image/png",
    }));
    expect(body.imageUrl).toBe("https://blob.vercel-storage.com/chat/u1/image.png");
  });
});
