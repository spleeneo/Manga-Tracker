# Functional Audit Checklist

This checklist captures expected behavior for core Mangateo flows and doubles as a source for automated test coverage.

## Core API flows

### `GET /api/manga/search`
- Returns `200` with `{ results: [] }` when `q` is missing.
- Returns `200` with aggregated results when scrapers succeed.
- Returns `500` with `{ error: "Failed to search" }` when registry search throws.

### `POST /api/manga`
- Returns `400` when both title and slug cannot be resolved.
- Creates a new `Manga` record when slug does not exist.
- Reuses existing `Manga` when slug already exists.
- Reuses known alias slugs instead of creating duplicate manga records.
- Creates missing `Source` records and avoids duplicate `(mangaId, sourceUrl)`.
- Enqueues a background manga sync job for newly added/empty source sets.
- Handles metadata fetch failure gracefully and still attempts creation with provided fields.

### `POST /api/source`
- Returns `400` when `mangaId`, `sourceName`, or `sourceUrl` are missing.
- Returns `404` when the target manga does not exist.
- Returns `409` for duplicate source name for the same manga.
- Returns `201` with created source payload on success.

### `POST /api/manga/chapter/[id]/read`
- Updates `isRead` to provided boolean and returns `200` with updated chapter.
- Returns `500` when update fails (invalid chapter id or DB error).

### `POST /api/manga/[slug]/check-updates`
- Returns `404` when manga is not found.
- Requires the signed-in user to track the manga.
- Marks the user's manga row as `SYNCING`.
- Enqueues or reuses one shared manga update job and schedules best-effort background processing.
- Returns `500` when queueing fails.

### `GET /api/cron/update`
- Requires a valid cron secret token.
- Enqueues every manga tracked by at least one user.
- Processes a bounded batch of shared update jobs.
- Returns queue counts such as `enqueued`, `processed`, `completed`, `failed`, and `remaining`.
- Returns `500` with `{ success: false }` on failure.

## Updater behavior (`checkForUpdates`)
- Skips manga with no sources and reports `"No sources identified"`.
- Attempts conservative MangaPill auto-enrichment for tracked manga without a MangaPill source.
- Keeps single-title sources as fallback sources without hiding broad providers.
- For each source, inserts only missing chapters by `(sourceId, chapterNumber)`.
- Continues processing other sources when one source scraper fails.
- Updates manga `updatedAt` when one or more new chapters are inserted.
- Returns per-manga status summary for UI/cron consumption.

## Queue behavior (`SyncJob`)
- Shared manga update jobs use `userId = null`.
- Only one queued/running shared update job should exist for a manga.
- Manual library sync marks the requesting user's library rows as `SYNCING` and enqueues shared jobs.
- Completed shared jobs mark waiting `UserManga` rows for that manga as `UPDATED`; permanent failures mark them `FAILED`.
- Queue processing claims due jobs atomically before running scraper work.

## Manual verification checklist
- Add manga via search flow and confirm source list and chapter ingestion.
- Add manga from a provider search result and confirm metadata fallback behavior when a scraper has sparse metadata.
- Trigger update checks for an existing manga and confirm strict MangaPill matches can add a source automatically.
- Trigger per-manga and global update endpoints and confirm no duplicate chapters.
- Toggle chapter read/unread and confirm state is persisted after reload.

## Automated test mapping
- Add route-level tests for `api/manga`, `api/source`, `api/manga/search`, `api/manga/chapter/[id]/read`.
- Add updater integration test for chapter dedupe and partial source failure.
- Add guard tests for cron endpoint secret enforcement.
