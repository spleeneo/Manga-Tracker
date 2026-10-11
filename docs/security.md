# Security

Mangateo uses Google OAuth through Auth.js. The app should treat manga library membership and chapter read state as user-owned data, even though manga metadata, sources, and chapters are shared records.

## Auth Rules

- Users must sign in before viewing their library.
- Google OAuth can be restricted with `ALLOWED_EMAILS`.
- Session user ids come from Auth.js and are exposed through `getCurrentUserId()`.

## Ownership Rules

Endpoints that read or mutate user-relevant manga data must verify:

1. The request has a signed-in user.
2. The requested manga exists.
3. The user has a `UserManga` row for that manga.

Routes that currently enforce ownership include:

- `POST /api/source`
- `POST /api/manga/chapter/[id]/read`
- `POST /api/manga/[slug]/check-updates`
- `POST /api/manga/[slug]/refresh-metadata`
- `GET /api/manga/get`

The cron route is different: it is not user-scoped, but it must be protected by `CRON_SECRET`.

## Shared Data Caveat

`Manga`, `Source`, and `Chapter` are shared records. Updating metadata or adding chapters changes the shared catalog for every user tracking that manga. That is intended, but endpoint ownership checks still prevent random users from triggering work for manga they do not track.

## Secret Handling

Do not commit:

- Neon connection strings
- Google OAuth secrets
- `AUTH_SECRET`
- `CRON_SECRET`

If any secret appears in chat, logs, screenshots, or a commit, rotate it in the provider dashboard and update local/Vercel environment variables.

## Future Hardening

- Add rate limiting for search, source creation, and manual update endpoints.
- Extend audit-friendly logs beyond the existing queue/provider diagnostics.
- Review source URL validation and rate limits as provider integrations expand.

## Image Proxy And Search Boundaries

- The image proxy accepts reviewed HTTPS provider/CDN destinations only, denies private DNS destinations, validates every redirect, and rebuilds provider headers per hop.
- It accepts raster image response types only and caps declared and streamed bodies at 15 MiB. An eight-second request budget remains active while reading the body. Unsupported hosts or upstream failures return an image failure that the cover UI handles.
- Host additions require review; provider CDN changes can otherwise cause image fallbacks. The proxy checks DNS but does not pin the resolved address, so the reviewed-domain trust boundary remains important.
- Adult search caches contain shared metadata only. Library membership is decorated after cache retrieval. Child searches and previews retain the permitted catalog path, opaque source references, and policy-aware cover/tracking routes.
- Durable shared scraper jobs already prevent duplicate active work through atomic claims; queue depth, age, and duration are observable in cron output.
