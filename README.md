# Manga Tracker

A personal manga tracking application that aggregates chapters from multiple free sources (official and community) into a single interface.

## Features

- **Multi-Source Tracking**: Aggregate chapters from MangaDex, NeloManga, MangaPlus, Webtoon, Manganato, and more.
- **Unified Library**: Track all your reading progress in one place.
- **Auto-Updates**: Automatically fetch new chapters from tracked sources.
- **Clean UI**: A solid, distraction-free interface (no glassmorphism!) designed for readability.
- **Click-to-Add**: Easily add manga from search results with a single click.

## Chosen Free Stack

- **Hosting**: Vercel Hobby
- **Database**: Neon Free Postgres
- **ORM**: Prisma with Neon pooled runtime connections
- **Scheduler**: Vercel Cron hitting `GET /api/cron/update` daily
- **Auth**: Auth.js with Google OAuth and Prisma-backed sessions

## Prerequisites

- **Node.js**: Version 18 or higher recommended.
- **npm**: Comes with Node.js.
- **Neon Postgres**: Create a free Neon project and copy both connection strings.

## Installation & Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Copy `.env.example` to `.env` and fill in the Neon connection strings.
    Use the pooled connection string for `DATABASE_URL` and the direct connection string for `DIRECT_URL`.
    Without `DATABASE_URL`, the app will show a setup screen instead of querying the database.

3.  **Database Setup**
    This project uses Postgres via Prisma. Apply migrations to create the tables.
    ```bash
    npm run db:migrate
    ```

4.  **Run the Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development Commands

- `npm run dev`: starts the development server at `localhost:3000`.
- `npm run build`: builds the application for production.
- `npm run start`: starts the production server.
- `npm run lint`: runs the linter to check for code issues.
- `npm run test`: runs automated tests with Vitest.
- `npm run db:generate`: regenerates Prisma Client.
- `npm run db:migrate`: applies Prisma migrations.
- `npm run db:reset`: wipes all manga, sources, and chapters.

## Operational Endpoints

- `GET /api/health`: service health/readiness endpoint (database + provider status).
- `GET /api/cron/update`: triggers update scan for all ongoing manga.
  - Requires `CRON_SECRET` and one of:
    - `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically when `CRON_SECRET` exists),
    - header `x-cron-secret`, or
    - query param `?secret=...`

## Deploying on Vercel + Neon

1. Create a Neon project on the free plan.
2. In Vercel project settings, set:
   - `DATABASE_URL`: Neon pooled connection string.
   - `DIRECT_URL`: Neon direct connection string.
   - `CRON_SECRET`: a random string of at least 16 characters.
   - `AUTH_SECRET`: a second random string of at least 32 characters.
   - `AUTH_GOOGLE_ID`: Google OAuth client ID.
   - `AUTH_GOOGLE_SECRET`: Google OAuth client secret.
   - `ALLOWED_EMAILS`: optional comma-separated allowlist.
3. Deploy the app from GitHub.
4. Vercel will run `postinstall` and generate Prisma Client.
5. Run `npm run db:migrate` locally against Neon, or use `npx prisma migrate deploy` in a trusted deployment step.

`vercel.json` schedules the update cron once per day at 05:00 UTC. Increase frequency only after checking provider rate limits and Vercel/Neon free-tier usage.

## Google Login Setup

1. In Google Cloud Console, create an OAuth 2.0 Client ID for a web application.
2. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://manga-tracker-eight.vercel.app/api/auth/callback/google`
3. Copy the client ID and client secret into local `.env` and Vercel environment variables:
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
4. Restart local dev or redeploy Vercel.

When Google OAuth is not configured, the app shows a setup badge instead of a broken sign-in button.

## Resetting the Database

If you need to clear all data and start fresh, run:

```bash
npm run db:reset
```

This will execute a script to delete all entries from the configured Postgres database.

## Project Structure

- `src/app`: Next.js App Router pages and API routes.
- `src/components`: UI components (MangaCard, ChapterList, etc.).
- `src/lib`: core utilities (database, scrapers).
- `scripts`: Maintenance scripts (reset-db, cleanup-db).
- `prisma`: Database schema (`schema.prisma`).

## Contributing

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes (`git commit -m 'Add some amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing-feature`)
5.  Open a Pull Request
