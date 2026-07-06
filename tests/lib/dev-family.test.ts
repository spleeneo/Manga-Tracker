import { describe, expect, it } from "vitest";
import { devFamilyRoleForHost, parseDevFamilyRole } from "@/lib/dev-family";

describe("parseDevFamilyRole", () => {
  it("accepts only the two development family roles", () => {
    expect(parseDevFamilyRole("parent")).toBe("parent");
    expect(parseDevFamilyRole("child")).toBe("child");
    expect(parseDevFamilyRole("admin")).toBeNull();
    expect(parseDevFamilyRole(null)).toBeNull();
  });
});

describe("devFamilyRoleForHost", () => {
  it("assigns one unambiguous role to each local origin", () => {
    expect(devFamilyRoleForHost("localhost:3000")).toBe("parent");
    expect(devFamilyRoleForHost("127.0.0.1:3000")).toBe("child");
    expect(devFamilyRoleForHost("192.168.1.10:3000")).toBeNull();
  });
});
