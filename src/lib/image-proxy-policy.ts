import { isIP } from "node:net";

// Provider/CDN domains only; review new image hosts before adding them.
const IMAGE_DOMAINS = ["uploads.mangadex.org", "mangadex.network", "readdetectiveconan.com", "nelomanga.net", "2xstorage.com", "waitst.com", "manganato.com", "mangakakalot.com", "mkklcdnv6temp.com", "mkklcdnv6.com", "witchhatateliermanga.com", "land-of-the-lustrous.online", "bleach.live", "blue-lock-manga.com", "firepunch.xyz", "urekmazino.com", "read.one-punch.online", "atsu.moe", "atsumaru.com", "comikey.com", "comikey.net", "viz.com", "webtoons.com", "pstatic.net", "shueisha.co.jp", "tokyo-cdn.com"];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const EXACT_IMAGE_HOSTS = ["dw9to29mmj727.cloudfront.net"];

export function allowedImageUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !(EXACT_IMAGE_HOSTS.includes(url.hostname) || IMAGE_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)))) throw new Error("Image destination is not allowed");
  return url;
}

export function publicImageAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19)));
  }
  return isIP(address) === 6 && /^[23]/i.test(address) && !address.toLowerCase().startsWith("2001:db8:");
}

export async function readImageBody(response: Response) {
  let contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType && !["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(contentType)) { await response.body?.cancel(); throw new Error("Unsupported image type"); }
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) { await response.body?.cancel(); throw new Error("Image too large"); }
  if (!response.body) throw new Error("Missing image body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_IMAGE_BYTES) throw new Error("Image too large");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  // VIZ's established CDN omits the header on JPEG covers. Never infer from the URL.
  if (!contentType) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) contentType = "image/jpeg";
    else throw new Error("Unsupported image type");
  }
  return { bytes, contentType };
}
