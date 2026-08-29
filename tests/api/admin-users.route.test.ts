import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminActor: vi.fn(), userFindUnique: vi.fn(), userCount: vi.fn(), userUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(), libraryFindMany: vi.fn(), libraryUpdateMany: vi.fn(), syncJobUpdateMany: vi.fn(), enqueue: vi.fn(), linkFindFirst: vi.fn(),
  processJobs: vi.fn(), overrideDeleteMany: vi.fn(), policyDeleteMany: vi.fn(), linkDelete: vi.fn(), transaction: vi.fn(),
}));

vi.mock("@/lib/admin-server", () => ({ getAdminActor: mocks.getAdminActor }));
vi.mock("@/lib/sync-jobs", () => ({ enqueueMangaSyncJob: mocks.enqueue, processSyncJobs: mocks.processJobs }));
vi.mock("@/lib/db", () => ({ prisma: {
  user: { findUnique: mocks.userFindUnique, count: mocks.userCount, update: mocks.userUpdate },
  session: { deleteMany: mocks.sessionDeleteMany }, userManga: { findMany: mocks.libraryFindMany, updateMany: mocks.libraryUpdateMany },
  syncJob: { updateMany: mocks.syncJobUpdateMany },
  parentChildLink: { findFirst: mocks.linkFindFirst, delete: mocks.linkDelete },
  childMangaOverride: { deleteMany: mocks.overrideDeleteMany }, childPolicy: { deleteMany: mocks.policyDeleteMany },
  $transaction: mocks.transaction,
} }));

import { PATCH } from "@/app/api/admin/users/[id]/route";
import { DELETE as revokeSessions } from "@/app/api/admin/users/[id]/sessions/route";
import { POST as retrySyncs } from "@/app/api/admin/users/[id]/sync-retries/route";
import { DELETE as unlinkFamily } from "@/app/api/admin/users/[id]/family-links/[linkId]/route";

const context = (id = "target") => ({ params: Promise.resolve({ id }) });

describe("admin user routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminActor.mockResolvedValue({ user: { id: "admin", role: "ADMIN" }, status: 200 });
    mocks.libraryUpdateMany.mockResolvedValue({ count: 0 });
    mocks.syncJobUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("requires administrator access", async () => {
    mocks.getAdminActor.mockResolvedValue({ user: null, status: 401 });
    let response = await PATCH(new Request("http://local", { method: "PATCH", body: JSON.stringify({ role: "ADMIN" }) }), context());
    expect(response.status).toBe(401);
    mocks.getAdminActor.mockResolvedValue({ user: null, status: 403 });
    response = await PATCH(new Request("http://local", { method: "PATCH", body: JSON.stringify({ role: "ADMIN" }) }), context());
    expect(response.status).toBe(403);
  });

  it("protects self-demotion and the final administrator", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "admin", role: "ADMIN" });
    let response = await PATCH(new Request("http://local", { method: "PATCH", body: JSON.stringify({ role: "USER" }) }), context("admin"));
    expect(response.status).toBe(409);
    mocks.userFindUnique.mockResolvedValue({ id: "target", role: "ADMIN" });
    mocks.userCount.mockResolvedValue(1);
    response = await PATCH(new Request("http://local", { method: "PATCH", body: JSON.stringify({ role: "USER" }) }), context());
    expect(response.status).toBe(409);
  });

  it("updates another account role", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "target", role: "USER" });
    mocks.userUpdate.mockResolvedValue({ id: "target", role: "ADMIN" });
    const response = await PATCH(new Request("http://local", { method: "PATCH", body: JSON.stringify({ role: "ADMIN" }) }), context());
    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { role: "ADMIN" } }));
  });

  it("revokes another user's sessions but protects the actor", async () => {
    let response = await revokeSessions(new Request("http://local"), context("admin"));
    expect(response.status).toBe(409);
    mocks.userFindUnique.mockResolvedValue({ id: "target" });
    mocks.sessionDeleteMany.mockResolvedValue({ count: 2 });
    response = await revokeSessions(new Request("http://local"), context());
    expect(await response.json()).toEqual({ revoked: 2 });
  });

  it("queues only failed and stale syncs owned by the account", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "target" });
    mocks.libraryFindMany.mockResolvedValue([
      { id: "failed", mangaId: "m1", syncStatus: "FAILED", syncStartedAt: null, manga: { status: "ONGOING", syncJobs: [] } },
      { id: "healthy", mangaId: "m2", syncStatus: "UPDATED", syncStartedAt: null, manga: { status: "ONGOING", syncJobs: [] } },
      { id: "completed", mangaId: "m3", syncStatus: "UPDATED", syncStartedAt: null, manga: { status: "COMPLETED", syncJobs: [{ status: "FAILED" }] } },
      { id: "failed-job", mangaId: "m4", syncStatus: "UPDATED", syncStartedAt: null, manga: { status: "ONGOING", syncJobs: [{ status: "FAILED" }] } },
    ]);
    mocks.enqueue.mockResolvedValueOnce({ id: "job" }).mockResolvedValueOnce({ id: "job2" });
    mocks.processJobs.mockResolvedValue({ processed: 2, completed: 2, failed: 0, retrying: 0, skipped: 0, remaining: 0 });
    const response = await retrySyncs(new Request("http://local", { method: "POST", body: "{}" }), context());
    expect(await response.json()).toEqual({ queued: 2, settledCompleted: 1, skipped: 1, jobs: [{ id: "job" }, { id: "job2" }], processing: { processed: 2, completed: 2, failed: 0, retrying: 0, skipped: 0, remaining: 0 } });
    expect(mocks.enqueue).toHaveBeenCalledWith("target", "m1");
    expect(mocks.enqueue).toHaveBeenCalledWith("target", "m4");
    expect(mocks.processJobs).toHaveBeenCalledWith(["job", "job2"], { concurrency: 4 });
    expect(mocks.libraryUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "target", id: { in: ["completed"] } },
      data: expect.objectContaining({ syncStatus: "UPDATED", syncStartedAt: null, syncError: null }),
    }));
    expect(mocks.syncJobUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { type: "MANGA_UPDATE", mangaId: { in: ["m3"] }, status: { in: ["QUEUED", "RUNNING"] } },
      data: expect.objectContaining({ status: "DONE", lockedAt: null, error: null }),
    }));
  });

  it("unlinks only a relationship involving the target and cleans child controls", async () => {
    mocks.linkFindFirst.mockResolvedValue({ id: "link", childId: "child" });
    mocks.transaction.mockResolvedValue([]);
    const response = await unlinkFamily(new Request("http://local"), { params: Promise.resolve({ id: "target", linkId: "link" }) });
    expect(response.status).toBe(200);
    expect(mocks.linkFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "link" }) }));
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });
});
