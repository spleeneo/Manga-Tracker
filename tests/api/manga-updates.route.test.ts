import { beforeEach, describe, expect, it, vi } from "vitest";

const { afterMock, enqueueMangaSyncJobMock, getCurrentUserIdMock, processSyncJobMock, userMangaFindManyMock } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  enqueueMangaSyncJobMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  processSyncJobMock: vi.fn(),
  userMangaFindManyMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/sync-jobs", () => ({
  enqueueMangaSyncJob: enqueueMangaSyncJobMock,
  processSyncJob: processSyncJobMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userManga: {
      findMany: userMangaFindManyMock,
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
    enqueueMangaSyncJobMock
      .mockResolvedValueOnce({ id: "job1" })
      .mockResolvedValueOnce({ id: "job2" });
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(enqueueMangaSyncJobMock).not.toHaveBeenCalled();
  });

  it("queues updates for the signed-in user's tracked manga", async () => {
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.queued).toBe(2);
    expect(enqueueMangaSyncJobMock).toHaveBeenCalledTimes(2);
    expect(afterMock).toHaveBeenCalledOnce();
    expect(processSyncJobMock).not.toHaveBeenCalled();
  });
});
