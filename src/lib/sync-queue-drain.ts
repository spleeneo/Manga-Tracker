interface BatchResult {
  processed: number;
  completed: number;
  failed: number;
  retrying: number;
  skipped: number;
  remaining: number;
}

// Check the budget between small batches. Unclaimed work remains durable.
export async function drainSyncQueue(processBatch: (options: { limit: number; concurrency: number }) => Promise<BatchResult>, options: { maxJobs?: number; budgetMs?: number } = {}) {
  const startedAt = Date.now();
  const maxJobs = options.maxJobs ?? 80;
  const budgetMs = options.budgetMs ?? 180_000;
  const total = { processed: 0, completed: 0, failed: 0, retrying: 0, skipped: 0, remaining: 0 };
  do {
    const batch = await processBatch({ limit: Math.min(4, maxJobs - total.processed), concurrency: 4 });
    for (const field of ["processed", "completed", "failed", "retrying", "skipped"] as const) total[field] += batch[field];
    total.remaining = batch.remaining;
    if (!batch.processed || !batch.remaining) break;
  } while (total.processed < maxJobs && Date.now() - startedAt < budgetMs);
  return { ...total, durationMs: Date.now() - startedAt, budgetReached: total.remaining > 0 && (total.processed >= maxJobs || Date.now() - startedAt >= budgetMs) };
}
