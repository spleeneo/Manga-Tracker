# Performance Review

Date: 2026-05-09
Latest follow-up: 2026-05-09, after moving read progress to `UserManga.lastReadChapterNumber`.

## Summary

This review used a production build served locally on `http://localhost:3100` to avoid `next dev` noise. The current app is functional, but several paths can feel unresponsive because UI actions wait on network/database work and then trigger full route refreshes.

The original top issue was read-progress updates: "mark caught up" scaled linearly with the number of unread chapters because the UI sent one request per chapter. That path now uses one progress update on `UserManga`. Search and image loading remain visibly provider-bound.

## Environment And Commands

- App: Next.js 16.2.6, React 19.2.3, Prisma 6.19.2.
- Database: configured Postgres through `.env`.
- Sample data: 3 manga, 6 sources, 167 chapters, 2 users, 4 user-library rows, 65 user-chapter rows.
- Sample signed-in user: `mateo.parache@gmail.com`.
- Sample manga: `one-piece`.

Commands run:

```bash
npm run build
npm run start -- -p 3100
PERF_BASE_URL=http://localhost:3100 npx tsx scripts/perf-baseline.ts
```

The script measures authenticated data paths directly through Prisma because a true signed-in HTTP run requires a browser session cookie. The HTTP measurements use the local production server.

## Baseline Measurements

| Area | Median | Range | Notes |
| --- | ---: | ---: | --- |
| Signed-in home summary DB query | 38 ms | 37-48 ms | Loads manga summaries and one best row per distinct chapter; approx payload 9.9 KB for the sampled library. |
| Manga detail paged DB query path | 60 ms | 56-77 ms | Loads manga, sources, ownership progress, and first 61 chapter rows. |
| Progress write | 38 ms | 36-51 ms | Rollback benchmark equivalent to one `POST /api/manga/[slug]/progress` DB path, excluding HTTP/session overhead. |
| Previous caught-up write loop | 860 ms | 845-892 ms | Historical lower bound for 50 per-chapter writes before the progress refactor. |
| Unauthenticated home HTTP shell | 24 ms | 21-112 ms | Production server smoke; first request was warm-ish local production. |
| Add manga search API | 1187 ms | 945-1382 ms | Provider/network dependent. |
| Proxied cover image | 308 ms | 268-426 ms | Provider/network dependent; route returns immutable cache headers. |

Loaded data shape:

| Page/path | Current shape |
| --- | --- |
| Home | 1 tracked manga loaded 55 distinct best-chapter rows server-side, about 9.9 KB in the sampled summary result. |
| Detail | 3 sources, first 61 chapter rows, and one ownership/progress row, about 27.9 KB in the sampled result. |

## Follow-up Delta

- Home query payload dropped from about 31.7 KB to 14.6 KB for the sampled library after selecting only the fields used by the dashboard/card UI and dropping unused source data.
- Prisma query logging is now opt-in with `PRISMA_QUERY_LOG=1`, removing default query-log noise from page transitions.
- Read progress now lives on `UserManga.lastReadChapterNumber`; "mark caught up" uses one progress update instead of up to one request per unread chapter.
- The latest benchmark shows home summary loading at 38 ms median and progress writes at 38 ms median.

## Findings

1. **Read-progress writes are no longer the biggest responsiveness risk.**
   - Cards, dashboard, and chapter items now use `POST /api/manga/[slug]/progress`.
   - Read state is derived from chapter number, so "mark caught up" is one user-library row update.
   - Impact: addressed.

2. **Home page now sends summary data, but still computes distinct chapter summaries server-side.**
   - The browser no longer receives full chapter arrays for cards/dashboard.
   - At much larger scale, the next step is a persisted manga summary/progress cache or materialized latest-chapter table.
   - Impact: medium at scale. Effort: medium/high.

3. **Detail page initial load is paged and progress-derived.**
   - The first render loads one page of chapters and derives read state from `lastReadChapterNumber`.
   - Provider tabs still do client grouping/scoring within the loaded page.
   - Impact: improved; further gains are mostly UI/pagination polish.

4. **Provider-bound operations need clearer loading/caching behavior.**
   - Search took about 1.25 s median and image proxy took about 306 ms median locally.
   - These depend on external providers, so they need UI feedback, caching, and maybe provider-level timeouts rather than pure query optimization.
   - Impact: medium. Effort: medium.

5. **Prisma query logging used to be enabled unconditionally.**
   - This has been changed to `PRISMA_QUERY_LOG=1`.
   - Impact: addressed as a quick win.

6. **Current indexes mostly support ownership, but one common chapter query plan is weak on the sampled DB.**
   - `UserManga_userId_mangaId_key` supports ownership and user-library lookup.
   - `UserChapter_chapterId_idx` is used for single read-state lookup, then filters by `userId`; the unique `(userId, chapterId)` constraint exists and should support the upsert path.
   - `Chapter WHERE mangaId ORDER BY chapterNumber DESC` used a seq scan plus sort in the sample explain. With more chapters, this should use the existing `(mangaId, chapterNumber)` index or may need query/index tuning.
   - Impact: medium at scale. Effort: low/medium.

7. **Client bundle and render work are concentrated in broad client components.**
   - Client components include `LibraryDashboard`, `MangaCard`, `ChapterList`, `ChapterItem`, dialogs, update buttons, and theme selector.
   - Grouping/sorting by chapter number happens in client components and repeats in more than one place.
   - Impact: medium. Effort: medium.

## Recommended Backlog

1. **Persist or cache manga summary rows if libraries grow large.**
   - Current summary generation is a good next shape for small/medium libraries.
   - A larger library could benefit from precomputed latest/best chapter summaries.

2. **Improve external provider responsiveness.**
   - Add request timeouts to provider search/image paths.
   - Consider short-lived cache for search results.
   - Keep image proxy immutable caching, but consider `next/image` or an optimized image wrapper where feasible.

3. **Reduce refresh-heavy metadata/update flows.**
   - Source add, manga add, metadata refresh, and check updates still use `router.refresh()`.
   - Keep full refresh for now, but return updated fragments where practical.

4. **Gate Prisma query logging.**
   - Enable query logs only when a local env flag such as `PRISMA_QUERY_LOG=1` is set.
   - Default production/development app runs should not log every query.

5. **Keep the baseline script.**
   - Re-run `PERF_BASE_URL=http://localhost:3100 npx tsx scripts/perf-baseline.ts` before and after performance work.
   - Track the batch write and home query numbers as the main success metrics.

## Risks And Tradeoffs

- Progress-by-chapter-number means reading chapter 1182 marks chapter 1182 read across providers; per-provider read exceptions are intentionally not modeled.
- Optimistic UI improves feel but must avoid hiding failed writes.
- Home summary optimization now uses Postgres-specific `DISTINCT ON`, matching the deployed Neon target.
- Provider caching can serve slightly stale search results, but that is acceptable for search suggestions if the TTL is short.
- Image optimization must preserve provider headers/referers for sources like NeloManga.

## Acceptance Criteria For Implementation

- Caught-up and next-read actions use one client request and one `UserManga` update.
- Home page does not transfer full chapter histories just to render the library grid.
- `PRISMA_QUERY_LOG` should be opt-in.
- Existing tests pass: `npm run lint`, `npm run test`, `npm run build`.
- Add tests for the batch read endpoint before replacing UI calls.
- Re-run the baseline script and record before/after numbers in this document or a follow-up note.
