import { NextRequest } from 'next/server';
import { NELOMANGA_COOKIE, NELOMANGA_USER_AGENT, NELOMANGA_BASE } from "@/lib/scrapers/nelomanga-config";

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    const requestedReferer = request.nextUrl.searchParams.get('referer');

    if (!url) {
        return new Response('Missing URL parameter', { status: 400 });
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 8_000);
        const parsedUrl = new URL(url);
        const isNelo = url.includes('nelomanga.net') || url.includes('2xstorage.com') || url.includes('waitst.com');
        const isMangaPillCdn = parsedUrl.hostname.endsWith('readdetectiveconan.com');
        const isMangaDexUploads = parsedUrl.hostname === 'uploads.mangadex.org';
        const headers: Record<string, string> = {
            'User-Agent': isMangaDexUploads ? 'Mangateo/1.0' : NELOMANGA_USER_AGENT,
        };

        if (isNelo) {
            headers['Referer'] = `${NELOMANGA_BASE}/`;
            headers['Cookie'] = NELOMANGA_COOKIE;
        } else if (isMangaPillCdn) {
            const referer = requestedReferer ? new URL(requestedReferer) : new URL('https://mangapill.com/');
            headers['Referer'] = referer.hostname.endsWith('mangapill.com') ? referer.toString() : 'https://mangapill.com/';
        } else {
            headers['Referer'] = parsedUrl.origin;
        }

        const response = await fetch(url, { headers, signal: controller.signal });
        if (timeout) clearTimeout(timeout);

        if (!response.ok) {
            console.error(`Proxy failed for ${url}: ${response.status}`);
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        const buffer = await response.arrayBuffer();

        return new Response(buffer, {
            headers: {
                'Content-Type': contentType || 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Image proxy error:', error);
        return new Response('Failed to proxy image', { status: 500 });
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}
