# Operations

Mangateo is designed for a free or near-free setup using Vercel Hobby and Neon Free Postgres.

## Runtime Stack

- Next.js App Router
- Prisma ORM
- Neon Postgres
- Auth.js with Google OAuth
- Vercel Cron for scheduled updates

## Required Environment Variables

- `DATABASE_URL`: Neon pooled connection string for runtime queries.
- `DIRECT_URL`: Neon direct connection string for Prisma migrations.
- `CRON_SECRET`: secret used by the update cron endpoint.
- `AUTH_SECRET`: Auth.js session secret.
- `AUTH_GOOGLE_ID`: Google OAuth client id.
- `AUTH_GOOGLE_SECRET`: Google OAuth client secret.
- `ALLOWED_EMAILS`: optional comma-separated email allowlist.
- `ABLY_API_KEY`: Ably key used to publish global chat messages and issue browser token requests.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token used for global chat image uploads.

Use `.env.example` as the local template.

## Local Setup

```bash
npm install
npm run db:migrate
npm run dev
```

For simultaneous parent/child testing, run `npm run dev:family`, use the fake parent at
`http://localhost:3000`, and use the fake child at `http://localhost:3001`. The two development
processes use separate build directories and session-cookie names while sharing the database.

If `DATABASE_URL` is missing, the app shows a database setup screen rather than trying to query Prisma.

## Google OAuth

Create a Google OAuth web application and add redirect URIs for each environment:

- `http://localhost:3000/api/auth/callback/google`
- `http://127.0.0.1:3000/api/auth/callback/google`
- Production Vercel callback URL, for example `https://<project>.vercel.app/api/auth/callback/google`

For Google app publishing, use the public privacy policy URL:

- `https://mangateo.vercel.app/privacy`

After changing OAuth variables locally, restart the dev server. After changing them in Vercel, redeploy.

## Deployment

1. Create the Neon database.
2. Create an Ably app and a Vercel Blob store if global chat is enabled.
3. Set Vercel environment variables.
4. Connect Vercel to GitHub.
5. Deploy from `main`.
6. Run migrations with `npm run db:migrate` against the Neon database, or `npx prisma migrate deploy` in a trusted environment.

`postinstall` runs `prisma generate`, so Vercel should have a generated Prisma client after install.

Vercel functions are pinned to `fra1` in `vercel.json` and the App Router root exports the same preferred region. Keep the Neon database in a nearby European region, such as Frankfurt/eu-central-1, so Auth.js and Prisma queries do not pay cross-region latency on every request.

Use `/api/health` after deployment to confirm the function region and database timing. A healthy deployment should report `region: "fra1"` and a low `checks.databaseDurationMs`.

## Cron

`vercel.json` schedules `GET /api/cron/update` once per day at 10:00 UTC. That is noon in Paris during CEST. When Paris switches to CET, use `0 11 * * *` if strict local-noon timing matters.

The cron endpoint requires `CRON_SECRET` through one of:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret`
- `?secret=...`

Increase cron frequency only after checking provider rate limits and free-tier usage.

The cron route enqueues all non-completed manga tracked by at least one user and drains four-job batches with concurrency four. It stops between batches after 80 jobs or three minutes; remaining work stays queued. The function allows 300 seconds, leaving headroom for the last batch and response. This assumes Vercel Fluid compute is enabled, whose Hobby duration supports 300 seconds ([Vercel duration documentation](https://vercel.com/docs/functions/configuring-functions/duration)); confirm that setting in the deployment dashboard. The budget cannot interrupt an already-running batch, so monitor actual durations before increasing these limits.

Responses and structured server logs include processing duration, queue depth, running count, and oldest queued age. The current measured catalog has 32 eligible titles; the previous 20-job sweep could not cover it in one day. Reassess capacity as libraries grow, using backlog age and provider failure rates rather than raising cron frequency blindly.

Manga with unknown status remain eligible. Manual updates can run at any time, including for completed manga; they enqueue shared jobs and start best-effort processing through `after(...)`.

## Performance Baselines

Build with `NEXT_PUBLIC_PERF_DIAGNOSTICS=1` only for local measurement, then run `npm run start -- --port 3100`. The hidden `[data-performance-diagnostics]` output reports client readiness, layout shifts, reader element counts, and available heap measurements. It sends no analytics and is disabled in normal builds.

Run `npx tsx --env-file=.env --env-file=.env.local scripts/perf-baseline.ts` against that local server. The benchmark uses real summary queries and reuses the fake development parent's existing session without printing credentials; set `PERF_COOKIE_NAME=authjs.parent-session-token` when using a parent-role server. Never benchmark by copying another user's session.

For representative browser library size, `scripts/perf-library-fixture.ts seed` adds only test-parent memberships for existing shared titles from the largest available library. Run the same script with `cleanup` immediately after measurement; it removes only its prefixed memberships. See [performance-review.md](performance-review.md) for results and limits.

## Routine Checks

After completing changes, push them to `main` and deploy the Vercel project unless the user explicitly asks to keep the work local.

Before pushing meaningful changes:

```bash
npm run lint
npm run test
npm run build
```

Current lint warnings are from `<img>` usage in a few image-heavy components. They are known and not currently build-blocking.
