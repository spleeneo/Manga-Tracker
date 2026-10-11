import { NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { NELOMANGA_COOKIE, NELOMANGA_USER_AGENT, NELOMANGA_BASE } from "@/lib/scrapers/nelomanga-config";
import { allowedImageUrl, publicImageAddress, readImageBody } from "@/lib/image-proxy-policy";

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("url");
  if (!value) return new Response("Missing URL parameter", { status: 400 });
  let url: URL;
  try { url = allowedImageUrl(value); } catch { return new Response("Image destination is not allowed", { status: 400 }); }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = await lookup(url.hostname, { all: true });
      if (!addresses.length || addresses.some(({ address }) => !publicImageAddress(address))) throw new Error("Non-public destination");
      const hostMatches = (domain: string) => url.hostname === domain || url.hostname.endsWith(`.${domain}`);
      const headers: Record<string, string> = { "User-Agent": url.hostname === "uploads.mangadex.org" ? "Mangateo/1.0" : NELOMANGA_USER_AGENT, Referer: url.origin };
      if (["nelomanga.net", "2xstorage.com", "waitst.com"].some(hostMatches)) {
        headers.Referer = `${NELOMANGA_BASE}/`;
        headers.Cookie = NELOMANGA_COOKIE;
      } else if (hostMatches("readdetectiveconan.com")) {
        headers.Referer = "https://mangapill.com/";
        try {
          const referer = new URL(request.nextUrl.searchParams.get("referer") ?? headers.Referer);
          if (referer.protocol === "https:" && (referer.hostname === "mangapill.com" || referer.hostname.endsWith(".mangapill.com"))) headers.Referer = referer.toString();
        } catch { /* Use the safe default. */ }
      }
      const response = await fetch(url.toString(), { headers, signal: controller.signal, redirect: "manual" });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new Error("Invalid image redirect");
        url = allowedImageUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error("Upstream image unavailable"); }
      const { bytes, contentType } = await readImageBody(response);
      return new Response(bytes, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
    }
    throw new Error("Too many redirects");
  } catch {
    return new Response("Failed to proxy image", { status: 502 });
  } finally { clearTimeout(timeout); }
}
