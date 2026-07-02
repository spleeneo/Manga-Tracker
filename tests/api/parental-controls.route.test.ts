import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserId, linkFindUnique, linkFindMany, linkFindFirst, linkCreate, userFindUnique, policyUpsert, overrideUpsert, mangaFindUnique } = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(), linkFindUnique: vi.fn(), linkFindMany: vi.fn(), linkFindFirst: vi.fn(), linkCreate: vi.fn(),
  userFindUnique: vi.fn(), policyUpsert: vi.fn(), overrideUpsert: vi.fn(), mangaFindUnique: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUserId }));
vi.mock("@/lib/db", () => ({ prisma: {
  parentChildLink: { findUnique: linkFindUnique, findMany: linkFindMany, findFirst: linkFindFirst, create: linkCreate },
  user: { findUnique: userFindUnique }, childPolicy: { upsert: policyUpsert },
  childMangaOverride: { upsert: overrideUpsert }, manga: { findUnique: mangaFindUnique },
} }));

import { GET, POST } from "@/app/api/parental-controls/route";
import { PUT } from "@/app/api/parental-controls/overrides/route";

describe("parental control APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks(); getCurrentUserId.mockResolvedValue("parent-1"); linkFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValueOnce({ email: "parent@example.com" }).mockResolvedValueOnce(null);
  });

  it("normalizes and creates a pending child invitation", async () => {
    linkCreate.mockResolvedValue({ id: "link-1", status: "PENDING" });
    const response = await POST(new Request("http://localhost/api/parental-controls", { method: "POST", body: JSON.stringify({ email: " Child@Example.COM " }) }));
    expect(response.status).toBe(201);
    expect(linkCreate).toHaveBeenCalledWith({ data: { parentId: "parent-1", childEmail: "child@example.com", childId: undefined, status: "PENDING" } });
  });

  it("rejects duplicate invitations", async () => {
    linkFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "existing" });
    const response = await POST(new Request("http://localhost/api/parental-controls", { method: "POST", body: JSON.stringify({ email: "child@example.com" }) }));
    expect(response.status).toBe(409);
  });

  it("prevents an active child from managing controls", async () => {
    linkFindUnique.mockResolvedValue({ status: "ACTIVE" });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(linkFindMany).not.toHaveBeenCalled();
  });

  it("prevents unrelated parents from overriding a title", async () => {
    linkFindFirst.mockResolvedValue(null);
    const response = await PUT(new Request("http://localhost/api/parental-controls/overrides", { method: "PUT", body: JSON.stringify({ childId: "child-1", mangaId: "m1", decision: "ALLOW" }) }));
    expect(response.status).toBe(404);
    expect(overrideUpsert).not.toHaveBeenCalled();
  });
});
