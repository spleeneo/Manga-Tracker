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
- Add audit-friendly server logs for update runs and provider failures.
- Validate provider URLs before creating sources.
- Consider a queue for scraper work to avoid long API requests and duplicate concurrent update jobs.
