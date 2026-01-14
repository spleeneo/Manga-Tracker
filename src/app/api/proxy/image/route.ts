import { NextRequest } from 'next/server';
import { NELOMANGA_COOKIE, NELOMANGA_USER_AGENT, NELOMANGA_BASE } from "@/lib/scrapers/nelomanga-config";

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return new Response('Missing URL parameter', { status: 400 });
    }

    try {
        const isNelo = url.includes('nelomanga.net') || url.includes('2xstorage.com') || url.includes('waitst.com');
        const headers: Record<string, string> = {
            'User-Agent': NELOMANGA_USER_AGENT,
        };

        if (isNelo) {
            headers['Referer'] = `${NELOMANGA_BASE}/`;
            headers['Cookie'] = NELOMANGA_COOKIE;
        } else {
            headers['Referer'] = new URL(url).origin;
        }

        const response = await fetch(url, { headers });

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
    }
}
