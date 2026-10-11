import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/proxy/image/route";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
import { lookup } from "node:dns/promises";

describe("GET /api/proxy/image", () => {
  it("rejects arbitrary hosts without fetching", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(new NextRequest("http://localhost/api/proxy/image?url=https://localhost/image.jpg"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects redirects outside approved destinations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } }));
    const response = await GET(new NextRequest("http://localhost/api/proxy/image?url=https://uploads.mangadex.org/image.jpg"));
    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects approved hosts resolving to private addresses", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect((await GET(new NextRequest("http://localhost/api/proxy/image?url=https://uploads.mangadex.org/image.jpg"))).status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(lookup).mockResolvedValue([{ address: "1.1.1.1", family: 4 }] as never);
  });

  it("uses a MangaPill referer for MangaPill CDN images", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } }));
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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } }));
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
