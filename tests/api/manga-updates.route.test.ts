import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkForUpdatesMock, getCurrentUserIdMock, userMangaFindManyMock } = vi.hoisted(() => ({
  checkForUpdatesMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  userMangaFindManyMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/manga-updater", () => ({
  checkForUpdates: checkForUpdatesMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userManga: {
      findMany: userMangaFindManyMock,
    },
  },
}));

import { POST } from "@/app/api/manga/updates/route";

describe("POST /api/manga/updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    userMangaFindManyMock.mockResolvedValue([
      { mangaId: "m1", manga: { title: "One Piece" } },
      { mangaId: "m2", manga: { title: "Berserk" } },
    ]);
    checkForUpdatesMock.mockResolvedValue([{ status: "ok" }]);
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(checkForUpdatesMock).not.toHaveBeenCalled();
  });

  it("checks updates for the signed-in user's tracked manga", async () => {
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(checkForUpdatesMock).toHaveBeenCalledTimes(2);
    expect(checkForUpdatesMock).toHaveBeenNthCalledWith(1, "m1");
    expect(checkForUpdatesMock).toHaveBeenNthCalledWith(2, "m2");
  });
});
