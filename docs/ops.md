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

Use `.env.example` as the local template.

## Local Setup

```bash
npm install
npm run db:migrate
npm run dev
```

If `DATABASE_URL` is missing, the app shows a database setup screen rather than trying to query Prisma.

## Google OAuth

Create a Google OAuth web application and add redirect URIs for each environment:

- `http://localhost:3000/api/auth/callback/google`
- Production Vercel callback URL, for example `https://<project>.vercel.app/api/auth/callback/google`

After changing OAuth variables locally, restart the dev server. After changing them in Vercel, redeploy.

## Deployment

1. Create the Neon database.
2. Set Vercel environment variables.
3. Connect Vercel to GitHub.
4. Deploy from `main`.
5. Run migrations with `npm run db:migrate` against the Neon database, or `npx prisma migrate deploy` in a trusted environment.

`postinstall` runs `prisma generate`, so Vercel should have a generated Prisma client after install.

Vercel functions are pinned to `fra1` in `vercel.json` and the App Router root exports the same preferred region. Keep the Neon database in a nearby European region, such as Frankfurt/eu-central-1, so Auth.js and Prisma queries do not pay cross-region latency on every request.

Use `/api/health` after deployment to confirm the function region and database timing. A healthy deployment should report `region: "fra1"` and a low `checks.databaseDurationMs`.

## Cron

`vercel.json` schedules `GET /api/cron/update` once per day at 05:00 UTC.

The cron endpoint requires `CRON_SECRET` through one of:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret`
- `?secret=...`

Increase cron frequency only after checking provider rate limits and free-tier usage.

## Routine Checks

Before pushing meaningful changes:

```bash
npm run lint
npm run test
npm run build
```

Current lint warnings are from `<img>` usage in a few image-heavy components. They are known and not currently build-blocking.
