import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  isDatabaseConfigured: true,
  prisma: {
    $queryRaw: queryRaw,
  },
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when db query works", async () => {
    queryRaw.mockResolvedValue([1]);
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("returns 503 when db query fails", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
