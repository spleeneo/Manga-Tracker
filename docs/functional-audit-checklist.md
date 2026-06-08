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
- Creates missing `Source` records and avoids duplicate `(mangaId, sourceName)`.
- Triggers background `checkForUpdates(mangaId)` call for processed sources.
- Handles metadata fetch failure gracefully and still attempts creation with provided fields.

### `POST /api/source`
- Returns `400` when `mangaId`, `sourceName`, or `sourceUrl` are missing.
- Returns `404` when the target manga does not exist.
- Returns `409` for duplicate source name for the same manga.
- Returns `201` with created source payload on success.

### `POST /api/manga/chapter/[id]/read`
- Updates `isRead` to provided boolean and returns `200` with updated chapter.
- Returns `500` when update fails (invalid chapter id or DB error).

### `GET /api/manga/[slug]/check-updates`
- Returns `404` when manga is not found.
- Calls updater for the specific manga id and returns update results.
- Returns `500` when updater throws.

### `GET /api/cron/update`
- Requires a valid cron secret token (to be implemented in hardening phase).
- Returns `{ success: true, results }` when updater succeeds.
- Returns `500` with `{ success: false }` on failure.

## Updater behavior (`checkForUpdates`)
- Skips manga with no sources and reports `"No sources identified"`.
- Attempts conservative MangaPill auto-enrichment for tracked manga without a MangaPill source.
- For each source, inserts only missing chapters by `(sourceId, chapterNumber)`.
- Continues processing other sources when one source scraper fails.
- Updates manga `updatedAt` when one or more new chapters are inserted.
- Returns per-manga status summary for UI/cron consumption.

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
