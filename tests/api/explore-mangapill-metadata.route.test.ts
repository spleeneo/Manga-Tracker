import { beforeEach, expect, it, vi } from "vitest";

const { user, policy, metadata } = vi.hoisted(() => ({ user: vi.fn(), policy: vi.fn(), metadata: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUserId: user }));
vi.mock("@/lib/parental-controls", () => ({ getChildPolicy: policy }));
vi.mock("@/lib/explore/mangapill-metadata", async importOriginal => ({ ...await importOriginal<object>(), getMangaPillSynopsis: metadata }));
import { GET } from "@/app/api/explore/mangapill/metadata/route";
const request = (url: string) => ({ nextUrl: new URL(`http://localhost/api/explore/mangapill/metadata?url=${encodeURIComponent(url)}`) }) as never;
const titleUrl = "https://mangapill.com/manga/10387/yankee-juku-e-iku";
beforeEach(() => { vi.clearAllMocks(); user.mockResolvedValue("parent"); policy.mockResolvedValue(null); metadata.mockResolvedValue({ description: "A synopsis" }); });
it("returns a synopsis for an authenticated adult", async () => {
  const res = await GET(request(titleUrl));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ description: "A synopsis" });
  expect(metadata).toHaveBeenCalledWith(titleUrl);
});
it("denies anonymous and child access before fetching or reading cached metadata", async () => {
  user.mockResolvedValue(null);
  expect((await GET(request(titleUrl))).status).toBe(401);
  user.mockResolvedValue("child"); policy.mockResolvedValue({ enabled: true });
  expect((await GET(request(titleUrl))).status).toBe(403);
  expect(metadata).not.toHaveBeenCalled();
});
it.each(["https://example.com/manga/10387/title", "https://mangapill.com.evil.test/manga/10387/title", "http://mangapill.com/manga/10387/title", "https://user:pass@mangapill.com/manga/10387/title", "https://mangapill.com:8443/manga/10387/title", "https://mangapill.com/chapters/123/title"])("rejects an unsupported metadata URL: %s", async url => {
  expect((await GET(request(url))).status).toBe(400);
  expect(metadata).not.toHaveBeenCalled();
});
it("reports upstream failure instead of claiming a missing synopsis", async () => {
  metadata.mockRejectedValue(new Error("Outage"));
  const res = await GET(request(titleUrl));
  expect(res.status).toBe(502);
  expect(await res.json()).toHaveProperty("error");
});
