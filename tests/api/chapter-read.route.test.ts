import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueChapter, findUniqueUserManga, upsertUserChapter } = vi.hoisted(() => ({
  findUniqueChapter: vi.fn(),
  findUniqueUserManga: vi.fn(),
  upsertUserChapter: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    chapter: { findUnique: findUniqueChapter },
    userManga: { findUnique: findUniqueUserManga },
    userChapter: { upsert: upsertUserChapter },
  },
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => "u1"),
}));

import { POST } from "@/app/api/manga/chapter/[id]/read/route";

describe("POST /api/manga/chapter/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates chapter read status", async () => {
    findUniqueChapter.mockResolvedValue({ id: "c1", mangaId: "m1" });
    findUniqueUserManga.mockResolvedValue({ id: "um1" });
    upsertUserChapter.mockResolvedValue({ id: "uc1", chapterId: "c1", isRead: true });
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ isRead: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "c1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isRead).toBe(true);
  });

  it("returns 500 if update fails", async () => {
    findUniqueChapter.mockRejectedValue(new Error("missing"));
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ isRead: false }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(500);
  });
});
