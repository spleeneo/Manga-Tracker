import { describe, expect, it } from "vitest";
import { isAdmin } from "@/lib/admin";

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
