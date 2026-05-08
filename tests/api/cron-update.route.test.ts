import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkForUpdates } = vi.hoisted(() => ({
  checkForUpdates: vi.fn(),
}));

vi.mock("@/lib/manga-updater", () => ({
  checkForUpdates,
}));

import { GET } from "@/app/api/cron/update/route";

function mockNextRequest(url: string, headers?: Record<string, string>) {
  return {
    nextUrl: new URL(url),
    headers: new Headers(headers),
  } as never;
}

describe("GET /api/cron/update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret123";
  });

  it("returns 401 without valid secret", async () => {
    const req = mockNextRequest("http://localhost/api/cron/update");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns success with valid header secret", async () => {
    checkForUpdates.mockResolvedValue([{ manga: "One Piece", status: "No new chapters updates" }]);
    const req = mockNextRequest("http://localhost/api/cron/update", {
      "x-cron-secret": "secret123",
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
