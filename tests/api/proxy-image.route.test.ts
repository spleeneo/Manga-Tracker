import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/proxy/image/route";

describe("GET /api/proxy/image", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses a MangaPill referer for MangaPill CDN images", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1)),
    } as unknown as Response);
    const imageUrl = "https://cdn.readdetectiveconan.com/file/mangap/2026/23/2/11184000/hash/1.jpeg";
    const referer = "https://mangapill.com/chapters/2-11184000/one-piece-chapter-1184";

    const response = await GET(new NextRequest(
      `http://localhost/api/proxy/image?url=${encodeURIComponent(imageUrl)}&referer=${encodeURIComponent(referer)}`,
    ));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(imageUrl, expect.objectContaining({
      headers: expect.objectContaining({
        Referer: referer,
      }),
    }));
  });

  it("uses the app user agent for MangaDex cover images", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1)),
    } as unknown as Response);
    const imageUrl = "https://uploads.mangadex.org/covers/md1/cover.jpg";

    const response = await GET(new NextRequest(
      `http://localhost/api/proxy/image?url=${encodeURIComponent(imageUrl)}`,
    ));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(imageUrl, expect.objectContaining({
      headers: expect.objectContaining({
        Referer: "https://uploads.mangadex.org",
        "User-Agent": "Mangateo/1.0",
      }),
    }));
  });
});
