# Performance Review

Date: 2026-05-09
Latest follow-up: 2026-10-11. The original May review below is historical; use the current baseline at the end for capacity and latency decisions.

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

## 2026-10-11 Production-Build Baseline

Measured with `next build`/`next start` on localhost:3100, configured Neon database, real providers, and the fake development parent session. These are local production-build measurements, not deployed Vercel timings. The updated benchmark samples actual library summary queries and does not print account/session credentials.

| Measurement | Sample | Median | Range |
| --- | --- | --- | --- |
| Summary query, small library | 1 title, 1,036-byte payload; 7 runs | 16 ms | 15–19 ms |
| Summary query, large library | 44 titles, 38,920-byte payload; 7 runs | 51 ms | 49–54 ms |
| Unauthenticated shell transfer | 5 runs | 38 ms | 34–448 ms |
| Authenticated library API | 2-title test library; 5 runs | 86 ms | 82–377 ms |
| Uncached reported-title search | 3 runs | 3,537 ms | 3,461–4,132 ms |
| Reader page discovery | One Piece; 3 runs | 322 ms | 259–424 ms |
| First reader image transfer | 3 runs | 87 ms | 40–100 ms |

Browser observations from the opt-in diagnostics output:

- Desktop 2-title library ready in 301 ms after diagnostics mounted; CLS 0.
- Mobile 390×844, temporary 45-title test-parent library ready in 516 ms; CLS 0. The 43 prefixed fixture memberships were removed afterward. No other account's progress/session was used.
- First One Piece image completed in 716 ms after diagnostics mounted; natural width 1,200 pixels; initial reader CLS 0.0294.
- A short continuous-reading session advanced through chapters 1–4 over several minutes. Heap observations were about 11.6–13.1 MB, with two or three mounted chapter sections (46–102 image nodes depending on chapter sizes). This is a smoke baseline, not proof of long-session memory stability.

Readiness is sampled every 100 ms starting after hydration; it excludes time before diagnostics mount. Heap is browser-specific and not forced-GC retained memory. Network/provider caches and cold starts affect transfer samples. No CPU/mobile-network throttling was applied. Measurements preceded the final library-cover lazy-loading change; repeat using the scripts for comparable post-deployment numbers.

Queue inspection found 32 eligible shared titles, four queued jobs, no running jobs, and an oldest queued age of about 47 minutes. The former daily 20-job ceiling was insufficient for one sweep. The new four-job drain is covered with simulated 32-job, budget-exhaustion, and maximum-job checks; real daily drain duration must be observed after deployment. A running batch is not preempted by the three-minute budget.

The evidence supports reducing unnecessary requests, pausing hidden-tab polling, and lazily loading covers before adding infrastructure. Library queries are small relative to provider search latency. MangaPlus returned upstream 403 during live search; partial-result diagnostics keep the successful sources usable.

Remaining measurement work: deployed Vercel cold/warm timings, a 30+ minute real-device reading session with heap snapshots, and browser network-failure injection. The automated UI acceptance regressions cover refresh failures, stale requests, partial provider failures, and next-chapter retry.
