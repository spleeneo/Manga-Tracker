import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueueTrackedMangaSyncJobs, processQueuedSyncJobs, getSyncQueueMetrics } = vi.hoisted(() => ({
  getSyncQueueMetrics: vi.fn(),
  enqueueTrackedMangaSyncJobs: vi.fn(),
  processQueuedSyncJobs: vi.fn(),
}));

vi.mock("@/lib/sync-jobs", () => ({
  enqueueTrackedMangaSyncJobs,
  processQueuedSyncJobs,
  getSyncQueueMetrics,
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
    enqueueTrackedMangaSyncJobs.mockResolvedValue({ enqueued: 2, jobs: [{ id: "j1" }, { id: "j2" }] });
    processQueuedSyncJobs.mockResolvedValue({ processed: 2, completed: 2, failed: 0, retrying: 0, skipped: 0, remaining: 0 });
    getSyncQueueMetrics.mockResolvedValue({ queued: 0, running: 0, oldestQueuedAgeMs: 0 });
  });

  it("returns 401 without valid secret", async () => {
    const req = mockNextRequest("http://localhost/api/cron/update");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns success with valid header secret", async () => {
    const req = mockNextRequest("http://localhost/api/cron/update", {
      "x-cron-secret": "secret123",
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.enqueued).toBe(2);
    expect(body.processed).toBe(2);
    expect(body.queue).toEqual({ queued: 0, running: 0, oldestQueuedAgeMs: 0 });
    expect(enqueueTrackedMangaSyncJobs).toHaveBeenCalledOnce();
    expect(processQueuedSyncJobs).toHaveBeenCalledWith({ limit: 4, concurrency: 4 });
  });
});
