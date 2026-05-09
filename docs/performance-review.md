# Performance Review

Date: 2026-05-09
Latest follow-up: 2026-05-09, after slimming the home query and making Prisma query logging opt-in.

## Summary

This review used a production build served locally on `http://localhost:3100` to avoid `next dev` noise. The current app is functional, but several paths can feel unresponsive because UI actions wait on network/database work and then trigger full route refreshes.

The top issue is read-progress updates. A single read update already costs roughly one database write path, and "mark caught up" scales linearly with the number of unread chapters because the UI sends one request per chapter. Search and image loading are also visibly provider-bound, and the home/detail pages currently load full chapter histories even when the UI mostly needs summary data.

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
| Signed-in home library DB query | 72 ms | 66-75 ms | Loads slim chapter fields for tracked manga; approx payload now 14.6 KB for the sampled library. |
| Manga detail DB query path | 85 ms | 78-172 ms | Loads manga, all chapters, sources, ownership, and user read rows. |
| Single chapter read write | 74 ms | 72-151 ms | Rollback benchmark equivalent to one read API DB path, excluding HTTP/session overhead. |
| Current caught-up write loop | 860 ms | 845-892 ms | Rollback lower bound for 50 chapter writes. Current UI also adds many HTTP requests. |
| Unauthenticated home HTTP shell | 47 ms | 39-490 ms | First request cold-started local production server. |
| Add manga search API | 1254 ms | 965-1433 ms | Provider/network dependent. |
| Proxied cover image | 306 ms | 279-494 ms | Provider/network dependent; route returns immutable cache headers. |

Loaded data shape:

| Page/path | Current shape |
| --- | --- |
| Home | 1 tracked manga loaded 65 chapter rows, about 31.7 KB JSON in the sampled Prisma result. |
| Detail | 3 sources, 65 chapter rows, 64 user read rows, about 45.5 KB JSON in the sampled Prisma result. |

## Follow-up Delta

- Home query payload dropped from about 31.7 KB to 14.6 KB for the sampled library after selecting only the fields used by the dashboard/card UI and dropping unused source data.
- Prisma query logging is now opt-in with `PRISMA_QUERY_LOG=1`, removing default query-log noise from page transitions.
- The next largest user-visible issue is still batch read progress: 50 sequential read writes measured 839 ms median in the latest rollback benchmark before HTTP/session overhead.

## Findings

1. **Batch read progress is the biggest responsiveness risk.**
   - Current cards and dashboard call `POST /api/manga/chapter/[id]/read` once per chapter and then call `router.refresh()`.
   - A 50-chapter rollback loop took about 860 ms before HTTP/session overhead. In the browser, parallel requests plus a full refresh will feel slower and jumpier.
   - Impact: high. Effort: medium.

2. **Home page still scales with chapter history, though the payload is slimmer now.**
   - `src/app/page.tsx` now selects only the fields rendered by the dashboard/cards, but it still fetches every chapter for each tracked manga.
   - This is acceptable for the current library size, but summary-only server data is still the better long-term shape.
   - Impact: medium/high as the library grows. Effort: medium/high.

3. **Detail page uses multiple broad reads for chapter/read state.**
   - `src/app/manga/[slug]/page.tsx` loads all chapters, then separately loads matching `UserChapter` rows.
   - This is acceptable for one 65-chapter title, but can grow quickly for long series or duplicate provider chapters.
   - Impact: medium. Effort: medium.

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

1. **Add a batch read-progress API.**
   - Add `POST /api/manga/chapters/read` with `{ chapterIds: string[], isRead: boolean }`.
   - Validate the user owns all affected manga before writing.
   - Use a single transaction and bulk-friendly reads before upserts.
   - Update dashboard/card/detail actions to call one endpoint for multi-chapter updates.

2. **Optimize perceived progress updates.**
   - Apply optimistic local state updates for read/caught-up actions.
   - Use `router.refresh()` only after the optimistic state is visible, or avoid it when local state is sufficient.
   - Keep failure rollback/toast behavior simple.

3. **Split home data into summary data and detail data.**
   - Home should load manga card/dashboard summaries: latest chapter, unread count, latest unread, status, cover, slug.
   - Avoid loading all chapter rows on the home page.
   - Keep full chapter history on the detail page.

4. **Tune detail query shape.**
   - Select only fields the UI renders.
   - Combine read-state decoration with fewer records transferred.
   - Keep source and chapter data normalized for provider tabs.

5. **Gate Prisma query logging.**
   - Enable query logs only when a local env flag such as `PRISMA_QUERY_LOG=1` is set.
   - Default production/development app runs should not log every query.

6. **Improve external provider responsiveness.**
   - Add request timeouts to provider search/image paths.
   - Consider short-lived cache for search results.
   - Keep image proxy immutable caching, but consider `next/image` or an optimized image wrapper where feasible.

7. **Keep the baseline script.**
   - Re-run `PERF_BASE_URL=http://localhost:3100 npx tsx scripts/perf-baseline.ts` before and after performance work.
   - Track the batch write and home query numbers as the main success metrics.

## Risks And Tradeoffs

- A batch read endpoint changes API surface and needs tests for ownership, missing chapters, mixed tracked/untracked manga, and partial invalid input.
- Optimistic UI improves feel but must avoid hiding failed writes.
- Home summary optimization may duplicate grouping logic unless summary helpers are shared carefully.
- Provider caching can serve slightly stale search results, but that is acceptable for search suggestions if the TTL is short.
- Image optimization must preserve provider headers/referers for sources like NeloManga.

## Acceptance Criteria For Implementation

- Batch progress action for 50 chapters should use one client request instead of 50.
- Home page should not transfer full chapter histories just to render the library grid.
- `PRISMA_QUERY_LOG` should be opt-in.
- Existing tests pass: `npm run lint`, `npm run test`, `npm run build`.
- Add tests for the batch read endpoint before replacing UI calls.
- Re-run the baseline script and record before/after numbers in this document or a follow-up note.
