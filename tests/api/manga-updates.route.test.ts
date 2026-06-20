import { beforeEach, describe, expect, it, vi } from "vitest";

const { afterMock, enqueueUserLibrarySyncJobsMock, getCurrentUserIdMock, processQueuedSyncJobsMock } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  enqueueUserLibrarySyncJobsMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  processQueuedSyncJobsMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/sync-jobs", () => ({
  enqueueUserLibrarySyncJobs: enqueueUserLibrarySyncJobsMock,
  processQueuedSyncJobs: processQueuedSyncJobsMock,
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: afterMock,
  };
});

import { POST } from "@/app/api/manga/updates/route";

describe("POST /api/manga/updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    enqueueUserLibrarySyncJobsMock.mockResolvedValue({ queued: 2, jobs: [{ id: "job1" }, { id: "job2" }] });
    processQueuedSyncJobsMock.mockResolvedValue({ processed: 2, completed: 2, failed: 0, retrying: 0, skipped: 0, remaining: 0 });
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(enqueueUserLibrarySyncJobsMock).not.toHaveBeenCalled();
  });

  it("queues updates for the signed-in user's tracked manga", async () => {
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.queued).toBe(2);
    expect(enqueueUserLibrarySyncJobsMock).toHaveBeenCalledWith("u1");
    expect(afterMock).toHaveBeenCalledOnce();
    expect(processQueuedSyncJobsMock).not.toHaveBeenCalled();
  });
});
