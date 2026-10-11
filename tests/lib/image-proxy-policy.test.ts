import { describe, expect, it } from "vitest";
import { allowedImageUrl, MAX_IMAGE_BYTES, publicImageAddress, readImageBody } from "@/lib/image-proxy-policy";

describe("image proxy policy", () => {
  it("accepts the established VIZ CDN without approving arbitrary CloudFront hosts", () => {
    expect(allowedImageUrl("https://dw9to29mmj727.cloudfront.net/social/91-OP_600x314.jpg").hostname).toBe("dw9to29mmj727.cloudfront.net");
    expect(() => allowedImageUrl("https://unreviewed.cloudfront.net/cover.jpg")).toThrow();
  });
  it("recognizes headerless JPEG covers but rejects headerless HTML", async () => {
    const jpeg = new Uint8Array([255, 216, 255, 225, 0, 24]);
    expect(await readImageBody(new Response(jpeg))).toMatchObject({ contentType: "image/jpeg", bytes: jpeg });
    await expect(readImageBody(new Response(new TextEncoder().encode("<html>Not an image</html>")))).rejects.toThrow("Unsupported image type");
  });
  it("requires HTTPS and exact domain boundaries", () => {
    for (const url of ["http://uploads.mangadex.org/a", "https://evilmangadex.org/a", "https://uploads.mangadex.org.evil.test/a", "https://user:pass@uploads.mangadex.org/a", "https://uploads.mangadex.org:8080/a"]) expect(() => allowedImageUrl(url)).toThrow();
    expect(allowedImageUrl("https://uploads.mangadex.org/a").hostname).toBe("uploads.mangadex.org");
  });
  it("blocks private, link-local, and mapped IPv6 destinations", () => {
    for (const address of ["10.0.0.1", "169.254.169.254", "172.16.1.1", "192.168.0.1", "::1", "::ffff:127.0.0.1", "fc00::1"]) expect(publicImageAddress(address)).toBe(false);
    expect(publicImageAddress("1.1.1.1")).toBe(true);
  });
  it("rejects non-images and oversized declared/streaming responses", async () => {
    await expect(readImageBody(new Response("html", { headers: { "content-type": "text/html" } }))).rejects.toThrow("Unsupported");
    await expect(readImageBody(new Response("x", { headers: { "content-type": "image/jpeg", "content-length": String(MAX_IMAGE_BYTES + 1) } }))).rejects.toThrow("too large");
    await expect(readImageBody(new Response(new Uint8Array(MAX_IMAGE_BYTES + 1), { headers: { "content-type": "image/jpeg" } }))).rejects.toThrow("too large");
  });
});
