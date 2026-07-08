import { describe, expect, it } from "vitest";
import { accountHealth, deriveActivity, isAdmin, isRetryableSync, sortAdminAccounts } from "@/lib/admin";

describe("isAdmin", () => {
  it("allows administrators", () => {
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
  });

  it("rejects regular and missing users", () => {
    expect(isAdmin({ role: "USER" })).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe("account diagnostics", () => {
  const now = new Date("2026-07-08T12:00:00Z");

  it("flags failed, stale, and incomplete-family states", () => {
    expect(accountHealth({ library: [{ syncStatus: "FAILED", syncStartedAt: null }], familyStatuses: [] }, now).level).toBe("attention");
    expect(accountHealth({ library: [{ syncStatus: "SYNCING", syncStartedAt: new Date("2026-07-08T11:40:00Z") }], familyStatuses: [] }, now).issues).toContain("Stale synchronization");
    expect(accountHealth({ library: [], familyStatuses: ["PENDING"] }, now).issues).toContain("Incomplete family setup");
  });

  it("recognizes only failed or stale syncs as retryable", () => {
    expect(isRetryableSync({ syncStatus: "FAILED", syncStartedAt: null }, now)).toBe(true);
    expect(isRetryableSync({ syncStatus: "SYNCING", syncStartedAt: new Date("2026-07-08T11:40:00Z") }, now)).toBe(true);
    expect(isRetryableSync({ syncStatus: "SYNCING", syncStartedAt: new Date("2026-07-08T11:55:00Z") }, now)).toBe(false);
  });

  it("derives explicit activity without treating background updates as user activity", () => {
    expect(deriveActivity({ readDates: [new Date("2026-07-01")], trackedDates: [new Date("2026-07-02")], chatDates: [new Date("2026-07-03")] })).toEqual({
      lastReadAt: new Date("2026-07-01"), lastTrackedAt: new Date("2026-07-02"), lastChatAt: new Date("2026-07-03"),
    });
  });

  it("sorts attention accounts before recent healthy accounts", () => {
    const result = sortAdminAccounts([
      { name: "Recent", health: "healthy" as const, lastReadAt: new Date("2026-07-08") },
      { name: "Needs help", health: "attention" as const, lastReadAt: null },
      { name: "Older", health: "healthy" as const, lastReadAt: new Date("2026-07-01") },
    ]);
    expect(result.map((item) => item.name)).toEqual(["Needs help", "Recent", "Older"]);
  });
});
