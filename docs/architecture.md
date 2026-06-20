# Architecture

Mangateo is a Next.js App Router application backed by Postgres through Prisma. The important architectural choice is that manga/catalog data is shared, while library membership and reading progress are per-user.

## Core Shape

- `Manga` stores shared title metadata: title, slug, cover, author, status, description.
- `Source` stores shared provider URLs for a manga.
- `Chapter` stores shared chapter records scraped from a source.
- `UserManga` links a user to a manga they track and stores per-user library state.
- `UserChapter` stores per-user read state for a shared chapter.

This means two users can track the same `Manga` and reuse the same `Source` and `Chapter` rows, but they do not share read progress.

## Request Flow

- Home page loads the signed-in user's `UserManga` library and decorates shared chapters with that user's `UserChapter.isRead`.
- Manga detail pages require the signed-in user to track the manga before showing it.
- Chapter read/unread updates write to `UserChapter`, not to the shared `Chapter.isRead` field.
- Add manga either reuses an existing `Manga` by slug or creates it, then upserts `UserManga` for the current user.
- Add source creates a shared `Source` only after verifying the current user tracks the manga.

## Update Flow

- Manual single-manga update calls `POST /api/manga/[slug]/check-updates`.
- Manual library update calls `POST /api/manga/updates`.
- Scheduled update calls `GET /api/cron/update`.
- Update requests enqueue shared `SyncJob` rows for manga-level work with `userId = null`, so one tracked manga is scraped once even when multiple users track it.
- Manual routes return after queueing and use Next.js `after(...)` to start best-effort background processing immediately.
- The daily cron enqueues all manga with at least one `UserManga` row and processes queued jobs as the scheduled sweep and retry safety net.
- Queued jobs are claimed with Postgres row locking and processed with bounded parallelism.
- `updateSingleManga` loads one manga and each source, scrapes chapters, and creates missing `Chapter` rows.
- Duplicate detection is per source using `providerChapterId` when available, with chapter number as a fallback.
- Metadata refresh uses the first source for the manga and updates shared `Manga` metadata.

## UI Structure

- Global design tokens and shared utility classes live in `src/app/globals.css`.
- Page shells are in `src/app/page.tsx` and `src/app/manga/[slug]/page.tsx`.
- Main interactive UI components live in `src/components`.
- Theme selection is stored under `mangateo-theme`, with a migration fallback for the old `manga-tracker-theme` key.

## Intentional Tradeoffs

- Shared manga/chapter data saves scraper work and keeps chapters deduplicated across users.
- Per-user read state avoids leaking progress between accounts.
- Current "Best Available" logic is heuristic, not true readability detection.
- Scrapers still run inside Vercel Functions, so manual background processing is best-effort; durable queued jobs remain in Postgres for the daily cron to retry.
