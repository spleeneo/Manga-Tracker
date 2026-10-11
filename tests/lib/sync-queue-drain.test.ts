import { afterEach, describe, expect, it, vi } from "vitest";
import { drainSyncQueue } from "@/lib/sync-queue-drain";

describe("bounded queue draining", () => {
  afterEach(() => vi.restoreAllMocks());
  it("drains libraries exceeding the old 20-job ceiling", async () => {
    let remaining = 32;
    const batch = vi.fn(async ({ limit }: { limit: number }) => { const processed = Math.min(limit, remaining); remaining -= processed; return { processed, completed: processed, failed: 0, retrying: 0, skipped: 0, remaining }; });
    expect(await drainSyncQueue(batch)).toMatchObject({ processed: 32, remaining: 0, budgetReached: false });
    expect(batch).toHaveBeenCalledTimes(8);
  });
  it("stops claiming work when the time budget is reached", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const batch = vi.fn(async () => { now += 100; return { processed: 4, completed: 4, failed: 0, retrying: 0, skipped: 0, remaining: 20 }; });
    expect(await drainSyncQueue(batch, { budgetMs: 100 })).toMatchObject({ processed: 4, remaining: 20, budgetReached: true });
    expect(batch).toHaveBeenCalledTimes(1);
  });
  it("respects job limits and stops on an empty batch", async () => {
    const batch = vi.fn(async ({ limit }: { limit: number }) => ({ processed: limit, completed: limit, failed: 0, retrying: 0, skipped: 0, remaining: 100 }));
    expect((await drainSyncQueue(batch, { maxJobs: 6 })).processed).toBe(6);
    expect(batch.mock.calls[1][0].limit).toBe(2);
  });
});
