import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUniqueManga, findUniqueSource, createSource, findUniqueUserManga } = vi.hoisted(() => ({
  findUniqueManga: vi.fn(),
  findUniqueSource: vi.fn(),
  createSource: vi.fn(),
  findUniqueUserManga: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: { findUnique: findUniqueManga },
    source: { findUnique: findUniqueSource, create: createSource },
    userManga: { findUnique: findUniqueUserManga },
  },
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => "u1"),
}));

import { POST } from "@/app/api/source/route";

describe("POST /api/source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for missing required fields", async () => {
    const req = new Request("http://localhost/api/source", {
      method: "POST",
      body: JSON.stringify({ mangaId: "id-only" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 404 when manga is missing", async () => {
    findUniqueManga.mockResolvedValue(null);

    const req = new Request("http://localhost/api/source", {
      method: "POST",
      body: JSON.stringify({
        mangaId: "m1",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/abc",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(404);
  });

  it("returns 409 for duplicate source names", async () => {
    findUniqueManga.mockResolvedValue({ id: "m1" });
    findUniqueUserManga.mockResolvedValue({ id: "um1" });
    findUniqueSource.mockResolvedValue({ id: "s1" });

    const req = new Request("http://localhost/api/source", {
      method: "POST",
      body: JSON.stringify({
        mangaId: "m1",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/abc",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(409);
  });

  it("returns 201 and creates source on success", async () => {
    findUniqueManga.mockResolvedValue({ id: "m1" });
    findUniqueUserManga.mockResolvedValue({ id: "um1" });
    findUniqueSource.mockResolvedValue(null);
    createSource.mockResolvedValue({ id: "s2", sourceName: "MangaDex" });

    const req = new Request("http://localhost/api/source", {
      method: "POST",
      body: JSON.stringify({
        mangaId: "m1",
        sourceName: "MangaDex",
        sourceUrl: "https://mangadex.org/title/abc",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(201);
    expect(createSource).toHaveBeenCalledOnce();
  });
});
