import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("admin diagnostics UI invariants", () => {
  it("keeps retry controls discoverable near quick diagnostics", () => {
    const detail = readSource("src/components/admin-user-detail.tsx");

    expect(detail).toContain("Quick insights");
    expect(detail).toContain("Retry problem syncs");
    expect(detail).toContain("Problem syncs");
    expect(detail).toContain("Sync health");
    expect(detail).toContain("Issue mix");
    expect(detail).toContain("Reading load");
    expect(detail).toContain("Routine sync skipped for finished manga.");
    expect(detail).toContain("Latest job:");
    expect(detail).not.toContain("What needs attention");
    expect(detail).not.toContain("Diagnostic detail");
    expect(detail).not.toContain("Retry all affected");
  });

  it("keeps account-list diagnostics compact and actionable", () => {
    const table = readSource("src/components/admin-accounts-table.tsx");

    expect(table).toContain("Library overview");
    expect(table).toContain("Diagnostics");
    expect(table).toContain("IssueMeter");
    expect(table).not.toContain("Open diagnostics");
  });
});
