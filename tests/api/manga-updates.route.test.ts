import { beforeEach, describe, expect, it, vi } from "vitest";

const { afterMock, checkForUpdatesMock, getCurrentUserIdMock, userMangaFindManyMock, userMangaUpdateMock } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  checkForUpdatesMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  userMangaFindManyMock: vi.fn(),
  userMangaUpdateMock: vi.fn(),
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
      update: userMangaUpdateMock,
    },
  },
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
    userMangaFindManyMock.mockResolvedValue([
      { mangaId: "m1", manga: { title: "One Piece" } },
      { mangaId: "m2", manga: { title: "Berserk" } },
    ]);
    checkForUpdatesMock.mockResolvedValue([{ status: "ok" }]);
    userMangaUpdateMock.mockResolvedValue({});
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(checkForUpdatesMock).not.toHaveBeenCalled();
  });

  it("queues updates for the signed-in user's tracked manga", async () => {
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.queued).toBe(2);
    expect(userMangaUpdateMock).toHaveBeenCalledTimes(2);
    expect(afterMock).toHaveBeenCalledOnce();
    expect(checkForUpdatesMock).not.toHaveBeenCalled();
  });
});
