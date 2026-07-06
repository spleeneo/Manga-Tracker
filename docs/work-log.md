# Work Log

## 2026-07-06 - Local parent/child test sessions

### Why

- Parental-control testing needs a parent and child account signed in simultaneously without their Auth.js sessions replacing each other.

### Plan

- Expose the local app on both loopback hostnames and document the OAuth and account setup needed for an isolated two-session workflow.

### Changes

- Added `npm run dev:family`, binding the Next.js development server to all local interfaces.
- Documented `localhost` for the parent and `127.0.0.1` for the child, including both Google OAuth callbacks and allowlist guidance.

### Verification

- Started `npm run dev:family` and confirmed both `http://localhost:3000` and `http://127.0.0.1:3000` returned HTTP 200 from the same development server.
- `npm run verify`: passed (lint with 8 pre-existing `no-img-element` warnings, full Vitest suite, and production build).

### Outcome

- Developers can keep parent and child Google accounts signed in concurrently on two cookie-isolated local origins while testing the same application data.

Use this file to leave a trace of meaningful work so it can be resumed, reviewed, debugged, and learned from later.

Add or update an entry when starting a feature, bug fix, refactor, investigation, or production-relevant change. Keep entries concise, but include enough context that someone can pick up the work without rereading the whole conversation.

Entry format:

```markdown
## YYYY-MM-DD - Short Work Title

Why:
- What problem, user need, risk, or opportunity motivated this work?

Plan:
- The intended approach or checklist.

Changed:
- Files, modules, routes, or behaviors changed.

Verification:
- Commands run, browser flows checked, CI status, or what could not be verified.

Outcome:
- Done, partially done, blocked, reverted, or follow-up needed.

Learnings:
- Link to `docs/learnings.md` entry when this work reveals a reusable lesson.
```

## 2026-07-04 - Prefer Unread Manga In Homepage Banner

Why:
- The homepage banner could select the most recently read manga even when its last available chapter had just been finished.
- The banner should instead continue the most recent reading activity that still has unread chapters.

Plan:
- Restrict recent-reading selection to manga with unread chapters.
- Preserve the existing newest-unread fallback for titles without reading history.
- Add focused regression tests and verify the rendered homepage banner.

Changed:
- Extracted the banner choice into `selectContinueReadingManga`.
- Recent reading history now wins only among titles with unread chapters.
- Added tests for skipping a newly caught-up manga and for the newest-unread fallback.

Verification:
- Ran `npm run test -- tests/lib/continue-reading.test.ts`: 2 tests passed.
- Verified the local homepage banner rendered an unread title, its unread count, and its next chapter; no browser console errors were present.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 200 passing tests, and a successful production build.

Outcome:
- Done. The banner no longer resurfaces a just-finished title while another recently read manga has unread chapters.

## 2026-07-04 - Skip Completed Manga In Daily Sync

Why:
- Completed manga do not need the same daily chapter polling as ongoing titles.

Plan:
- Exclude canonical `COMPLETED` manga from the scheduled tracked-manga sweep.
- Preserve manual sync behavior and daily syncing for titles with unknown status.
- Add a focused regression test and run update-flow and full verification.

Changed:
- Filtered `enqueueTrackedMangaSyncJobs` to omit `COMPLETED` manga while retaining null and other statuses.
- Added regression coverage for the scheduled enqueue query.
- Updated architecture and operations documentation to describe the policy.

Verification:
- Ran `npm run test -- tests/lib/sync-jobs.test.ts`: 6 tests passed.
- Ran `npm run smoke:update`: passed for Hunter x Hunter (Official Colored) through MangaDex; the known MangaPlus `Account Banned` discovery warning remains.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 198 passing tests, and a successful production build.

Outcome:
- Done. Daily scheduled syncs skip completed manga; manual syncs remain available.

## 2026-06-20 - Recover Stale Shared Sync Jobs

Why:
- After the shared queue rollout, many library rows stayed in `SYNCING`.
- Database inspection showed 21 `UserManga` rows in `SYNCING`, 31 shared `SyncJob` rows stuck in `RUNNING`, and 5 retryable queued jobs.
- The shared queue did not recover jobs left `RUNNING` when a best-effort Vercel background invocation stopped before completion.

Plan:
- Add stale `RUNNING` job recovery before enqueueing or processing sync jobs.
- Cover stale lock recovery with a focused queue test.
- Run focused tests, update smoke, and full verification.
- Requeue/process the currently stuck jobs after the fix is verified.

Changed:
- Added `recoverStaleRunningSyncJobs` to requeue shared `RUNNING` jobs older than 10 minutes.
- Call stale recovery before shared enqueueing, single-job processing, and queued-batch processing.
- Added a focused regression test for stale shared-job recovery.

Verification:
- Ran `npm run test -- tests/lib/sync-jobs.test.ts`: 5 tests passed.
- Ran `npm run test -- tests/lib/sync-jobs.test.ts tests/lib/manga-updater.test.ts tests/api/cron-update.route.test.ts tests/api/manga-updates.route.test.ts tests/api/manga-owned-routes.test.ts`: 22 tests passed.
- Ran `npm run smoke:update`: passed for Hunter x Hunter (Official Colored), with the known MangaPlus `Account Banned` discovery log.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 197 passing tests, and a successful production build.
- Ran a one-off recovery against the configured database: requeued 31 stale running shared jobs, processed due jobs in three rounds, and drained the due queue.
- Confirmed post-recovery database state: all 32 `UserManga` rows are `UPDATED`, 1109 sync jobs are `DONE`, 1 historical sync job is `FAILED`, and there are 0 queued/running/stale-running jobs.

Outcome:
- Done locally and repaired in the configured database. Future queue runs recover stale `RUNNING` jobs before enqueueing or processing work.

Learnings:
- See `docs/learnings.md`: "2026-06-20 - Serverless Queues Need Stale Lock Recovery".

## 2026-06-20 - Make Main Push The Default Delivery Rule

Why:
- The repository already said to push verified work to `main` when approved, but that left ambiguity after the user gave standing approval for this project.
- Future work should not remain local after verification unless the user explicitly asks to pause, keep it local, or avoid pushing.

Plan:
- Update always-read repository instructions.
- Align the development methodology delivery section with the same standing rule.
- Record the process change in the work log.

Changed:
- Updated `AGENTS.md` to say complete verified work should be committed and pushed to `main` by default.
- Updated `docs/development-methodology.md` default workflow and delivery language with the same rule.
- Added this work-log entry.

Verification:
- Documentation-only change reviewed by diff.

Outcome:
- Done locally; commit and push should follow immediately because this rule itself is now the delivery default.

Learnings:
- No new reusable learning added.

## 2026-06-20 - Review Delivery Rule Consistency

Why:
- The standing `main` delivery rule needed a second pass across project docs and GitHub templates to avoid contradictory instructions.

Plan:
- Search active repo instructions, docs, README, and GitHub templates for delivery, approval, push, and main-branch language.
- Update any active template or instruction that still made delivery approval sound like a per-change decision.
- Leave dated historical work-log entries unchanged because they describe past work rather than current rules.

Changed:
- Clarified `README.md` contributing notes so maintainer/AI work follows `AGENTS.md` while external contributors use branch-and-PR flow.
- Updated `.github/pull_request_template.md` so the delivery checklist names `main` delivery as the default and labels non-delivery as an exception.
- Added this work-log entry.

Verification:
- Ran `rg -n "approved|approval|approve|delivery|deliver|push|main|keep.*local|avoid pushing|pause before delivery|CI/CD|deploy" AGENTS.md README.md docs .github -S` and reviewed the matches.
- Documentation/template-only change reviewed by diff.

Outcome:
- Done locally; active instructions now consistently say verified work is delivered to `main` by default unless the user explicitly requests otherwise.

Learnings:
- No new reusable learning added.

## 2026-06-20 - Shared Daily Update Queue And Single-Manga Sync

Why:
- Library-wide syncing was slow because global updates processed manga mostly sequentially and manual routes could wait on provider scraping.
- Multiple users tracking the same manga should share one server-side update job instead of duplicating scraper work.
- Auto updates should stay compatible with Vercel Hobby daily cron and run around Paris noon.
- The UI needed a single-manga sync control in addition to the global library update button.

Plan:
- Refactor the updater around a single-manga update entry point.
- Move scheduled and manual updates onto shared `SyncJob` rows with `userId = null`.
- Process queued jobs with bounded parallelism and atomic Postgres claiming.
- Change the daily Vercel cron to 10:00 UTC for Paris noon during CEST.
- Add detail-page and library-card single-manga sync controls.
- Update tests, docs, smoke update, and full verification.

Changed:
- Added shared manga sync job enqueueing, user-library enqueueing, tracked-manga enqueueing, atomic job claiming, bounded parallel processing, and shared waiting-user completion/failure updates.
- Updated cron and manual update routes to queue work and start immediate best-effort background processing.
- Added a shared active-job partial unique index migration.
- Added single-manga sync controls to the manga detail page and library cards.
- Updated architecture, operations, README, and functional audit docs.

Verification:
- Ran `npm run test -- tests/lib/sync-jobs.test.ts tests/lib/manga-updater.test.ts tests/api/cron-update.route.test.ts tests/api/manga-updates.route.test.ts tests/api/manga-owned-routes.test.ts`: 21 tests passed.
- Ran `npm run lint`: passed with 8 existing `<img>` warnings.
- Ran `npm run smoke:update`: passed for Hunter x Hunter (Official Colored), with no failed sources. MangaPlus emitted the known upstream `Account Banned` discovery log, but the update completed successfully.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 196 passing tests, and a successful production build.
- Browser-verified the signed-in local library at `http://localhost:3000`: global Update Library button is visible and library cards expose icon-only "Sync this manga" buttons.
- Browser-verified `http://localhost:3000/manga/hunter-x-hunter`: the detail page exposes `Sync Manga`, and a live click returned the "Manga update started" success toast.

Outcome:
- Done locally. Daily cron now runs at 10:00 UTC, shared manga update jobs dedupe scraper work across users, manual updates queue work immediately, and single-manga sync is available from both library cards and manga detail pages.

Learnings:
- No new reusable learning yet.

## 2026-06-17 - Backfill Missing Sources For Tracked Manga

Why:
- Choujin X was tracked without MangaPill even though MangaPill has it at `https://mangapill.com/manga/5454/choujin-x`.
- MangaPill search returns the title as `Choujin X Overhuman X`, so the old exact-title-only MangaPill discovery rejected the correct result.
- Future providers should be discovered for already tracked manga during normal update cycles instead of only when a manga is first tracked.

Plan:
- Add shared source discovery that every searchable chapter provider can participate in.
- Keep matching strict, but accept exact provider URL slug matches in addition to exact title/alias matches.
- Run shared discovery before scraping sources during updates.
- Make the global update cycle operate on tracked manga so existing libraries can pick up newly added providers.
- Cover the Choujin X case and the future-provider backfill behavior with focused tests.

Changed:
- Added `src/lib/source-discovery.ts` for shared missing-source discovery.
- Updated MangaPill discovery to reuse the shared matcher.
- Updated `checkForUpdates` to attach missing registered provider sources before scraping.
- Updated the global update query to process tracked manga instead of only ongoing manga records.
- Added focused tests for URL-slug matching, generic source discovery, MangaPill's Choujin X title, and update-cycle source attachment.

Verification:
- Live-probed MangaPill search for `Choujin X`; the correct `https://mangapill.com/manga/5454/choujin-x` result now matches while other Choujin-like results do not.
- Ran `npm run test -- tests/lib/source-discovery.test.ts tests/lib/manga-updater.test.ts tests/scrapers/mangapill-discovery.test.ts`: 16 tests passed.
- Ran `npm run test -- tests/scrapers/provider-contract.test.ts tests/scrapers/mangapill.test.ts tests/scrapers/registry.test.ts`: 10 tests passed.
- Ran `npm run smoke:update`: passed for Hunter x Hunter (Official Colored), with no failed sources. MangaPlus emitted its existing upstream blocked search log, but the update completed successfully.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 194 passing tests, and a successful production build.
- Ran a targeted update for the configured `Choujin X` row (`38b04d72-b7be-4d0d-8e85-c01234845e57`): MangaPill was added at `https://mangapill.com/manga/5454/choujin-x`, 133 chapters were added, and no sources failed. MangaPlus emitted its existing upstream blocked search log during discovery.

Outcome:
- Done locally. Existing tracked manga can now pick up missing sources from registered searchable chapter providers during update checks, including Choujin X from MangaPill.

Learnings:
- See `docs/learnings.md`: "2026-06-17 - Source Discovery Needs URL-Slug Matching".

## 2026-06-17 - Align Source Order With Reader Targets

Why:
- Choujin X could show the dedicated source first on the manga page, while some reader entry points or fallbacks still preferred another provider.
- Reader fallback still had hardcoded provider priority and did not load per-manga source preferences.
- Newly discovered dedicated sources also needed a sensible default rank so the displayed source order and target selection do not diverge when no custom order has been saved yet.

Plan:
- Make the manga detail source list sort by the shared source ranking helper.
- Rank generic dedicated `* Manga` sources above MangaDex by default while keeping MangaPill above generic single-title fallbacks.
- Make reader fallback alternatives load saved source preferences and disabled sources.
- Add focused tests for fallback ordering and generic dedicated source rank.
- Re-check the configured Choujin X summary target.

Changed:
- Updated `getPreferredSourceRank` to rank generic dedicated manga sources ahead of MangaDex.
- Updated the manga detail page to sort sources by `getSourceRankScore`.
- Updated the reader route to exclude disabled alternative sources and sort fallback alternatives by saved source order.
- Added focused tests for source preference ranking and reader fallback ordering.

Verification:
- Ran `npm run test -- tests/api/chapter-reader.route.test.ts tests/lib/source-preference.test.ts tests/lib/source-ranking.test.ts tests/api/manga-chapters.route.test.ts`: 29 tests passed.
- Queried the configured Choujin X summary after the ranking changes: latest chapter 73 resolves to `Choujin X Manga` at `https://w1.choujin-x.online/comic/choujin-x-chapter-73/`.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 196 passing tests, and a successful production build.

Outcome:
- Done locally. Source ordering now drives manga detail source order, latest/next-unread target selection, chapter target selection, and non-external reader fallback alternatives.

Learnings:
- See `docs/learnings.md`: "2026-06-17 - Source Order Must Drive Every Reader Entry Point".

## 2026-06-02 - Development Process Guardrails

Why:
- We wanted to reduce broken changes by making the development methodology visible, enforceable, and reusable across future work.

Plan:
- Document the methodology.
- Add repo-level AI instructions.
- Add a pull request checklist.
- Add a local verification command.
- Align CI with the local verification command.
- Add places to record future learnings and work state.

Changed:
- Added `docs/development-methodology.md`.
- Added `docs/learnings.md`.
- Added `docs/work-log.md`.
- Added `AGENTS.md`.
- Added `.github/pull_request_template.md`.
- Added `npm run verify`.
- Updated CI to run `npm run verify`.
- Updated `README.md` documentation links.

Verification:
- Ran `npm run verify` after adding the methodology and CI enforcement. It passed with existing lint warnings about `<img>` usage, 134 passing tests, and a successful production build.
- Later additions were documentation-only and were reviewed by diff.

Outcome:
- Approved for delivery on 2026-06-02. The work will be committed and pushed to `main` so CI/CD runs and production deployment is triggered by the existing workflow.

Learnings:
- See `docs/learnings.md`: "2026-06-02 - Development Methodology Should Be Enforced".

## 2026-06-02 - App Review After Process Guardrails

Why:
- We wanted to use the new methodology immediately to review the current application state and the active working tree.

Plan:
- Read the repository instructions and methodology.
- Inspect the current working tree.
- Review app-facing changes first, especially chapter/progress behavior.
- Run `npm run verify`.
- Report findings first, with file and line references.

Changed:
- Added this work-log entry only.

Verification:
- Ran `npm run verify`. It passed with 7 existing lint warnings about `<img>` usage, 134 passing tests, and a successful production build.

Outcome:
- Review completed. Findings were identified around chapter target source selection and test coverage.

Learnings:
- No new reusable learning logged yet; fix work should add one if the issue confirms a broader rule.

## 2026-06-02 - Fix Chapter Target Source Selection

Why:
- The app review found that quick chapter buttons could open a different duplicate-source version than the chapter list or library summary would prefer.

Plan:
- Add focused route tests for chapter target selection across duplicate sources.
- Update the target API helper to find the target chapter number first.
- Select the preferred candidate for that chapter number using source ranking.
- Run focused tests, then full verification.

Changed:
- `src/lib/chapters.ts`
- `src/app/api/manga/[slug]/chapters/route.ts`
- `tests/api/manga-chapters.route.test.ts`
- `docs/learnings.md`
- `docs/work-log.md`

Verification:
- Ran `npm run test -- tests/api/manga-chapters.route.test.ts`: 7 tests passed.
- Ran `npm run verify`: passed with 7 existing `<img>` lint warnings, 136 passing tests, and a successful production build.
- Ran `npm run verify` again before delivery: passed with the same 7 existing `<img>` lint warnings, 136 passing tests, and a successful production build.

Outcome:
- Approved for delivery on 2026-06-02. Chapter targets now choose the boundary chapter number first, then prefer the best source candidate for that chapter number.

Learnings:
- See `docs/learnings.md`: "2026-06-02 - Chapter Targets Must Reuse Source Preference Rules".

## 2026-06-03 - Investigate MangaPlus Asura's Verdict Source

Why:
- Asura's Verdict was expected to be tracked from MangaPlus at `https://mangaplus.shueisha.co.jp/titles/100405`, but it was not showing in the app.

Plan:
- Confirm whether MangaPlus is registered and supports tracking.
- Run the MangaPlus scraper against title `100405`.
- Query the upstream MangaPlus title detail and title list APIs directly.
- Identify whether the issue is app filtering, chapter window logic, or upstream provider data.

Changed:
- Added this investigation record.
- Added a reusable learning about keeping upstream provider error payloads visible.

Verification:
- Ran repository searches confirming `MangaPlusScraper` is registered in `src/lib/scrapers/registry.ts`.
- Ran the local scraper against `https://mangaplus.shueisha.co.jp/titles/100405`; `fetchMetadata` failed with `Manga not found` and `fetchChapters` returned `[]`.
- Queried `https://jumpg-webapi.tokyo-cdn.com/api/title_detailV3?title_id=100405&format=json`; the upstream response was an `Account Banned` error payload instead of title/chapter data.
- Queried the MangaPlus all-titles API for `asura`; it returned no matching title from this environment.
- Ran `npm run verify`: passed with 7 existing `<img>` lint warnings, 136 passing tests, and a successful production build.

Outcome:
- The title is not showing because MangaPlus is blocking the API responses from this environment, not because the provider is unregistered.
- The app currently masks this provider failure as empty chapter results because `MangaPlusScraper.fetchChapters` catches failures and returns `[]`.
- Follow-up fix should surface MangaPlus upstream error payloads as source failures rather than silent empty results.

Learnings:
- See `docs/learnings.md`: "2026-06-03 - Provider Error Payloads Must Stay Visible".

## 2026-06-03 - Surface MangaPlus Upstream Errors During Updates

Why:
- The Asura's Verdict investigation showed that MangaPlus API errors were being converted into empty chapter lists, hiding provider failures from update status.

Plan:
- Add focused scraper coverage for MangaPlus upstream error payloads.
- Detect MangaPlus `error` responses in the JSON API wrapper.
- Preserve the MangaPlus error subject in the thrown scraper error.
- Let chapter update calls rethrow scraper request errors so `checkForUpdates` can mark the source failed.
- Run focused tests, update smoke, and full verification.

Changed:
- `src/lib/scrapers/mangaplus.ts`
- `tests/scrapers/mangaplus.test.ts`
- `docs/learnings.md`
- `docs/work-log.md`

Verification:
- Ran `npm run test -- tests/scrapers/mangaplus.test.ts`: 3 tests passed.
- Ran `npm run smoke:update`: passed. The smoke result continued updating other One Piece sources while reporting MangaPlus as one failed source with `MangaPlus upstream error: Account Banned`.
- Ran `npm run verify`: passed with 7 existing `<img>` lint warnings, 136 passing tests, and a successful production build.

Outcome:
- MangaPlus upstream error payloads now surface as `ScraperRequestError` messages such as `MangaPlus upstream error: Account Banned`.
- Update jobs can now persist MangaPlus provider failures instead of silently treating blocked responses as no new chapters.

Learnings:
- See `docs/learnings.md`: "2026-06-03 - Provider Error Payloads Must Stay Visible".

## 2026-06-05 - Skip Blue Lock Placeholder Chapters

Why:
- Blue Lock Manga advertised a new chapter whose page contained only a single placeholder-style image instead of readable manga pages, causing Mangateo to treat it as a real new chapter.

Plan:
- Reproduce the placeholder behavior in a focused single-manga-site scraper test.
- Require Blue Lock reader pages to meet a small page-count threshold.
- Probe the newest Blue Lock chapter during chapter scraping and skip it when the probe is not readable.
- Verify with the focused scraper test, a live Blue Lock scrape, update smoke, and full verification.

Changed:
- `src/lib/scrapers/single-manga-sites.ts`
- `tests/scrapers/single-manga-sites.test.ts`
- `docs/learnings.md`
- `docs/work-log.md`
- Removed the existing Blue Lock chapter 349 placeholder row from the configured database.

Verification:
- Ran `npm run test -- tests/scrapers/single-manga-sites.test.ts`: 11 tests passed.
- Ran a live Blue Lock scrape with `npx tsx`; chapter 349 was skipped and chapter 348 was returned as the newest chapter.
- Queried the database for Blue Lock chapter 349, deleted the one `Blue Lock Manga` row, and confirmed no chapter 349 rows remained.
- Ran `npm run smoke:update`: passed. The smoke result completed the One Piece update cycle while reporting the known MangaPlus `Account Banned` source failure.
- Ran `npm run verify`: passed with 7 existing `<img>` lint warnings, 137 passing tests, and a successful production build.

Outcome:
- Blue Lock placeholder-only latest chapters are skipped during scraping, preventing them from being inserted as new chapters by update checks.

Learnings:
- See `docs/learnings.md`: "2026-06-05 - Latest Chapter Links May Be Placeholders".

## 2026-06-05 - Prefer Maison MangaPlus Chapter 35

Why:
- Maison chapter 35 is available on MangaPlus, but the local catalog only had the MangaDex chapter 35 row, which points readers back to MangaPlus instead of opening the official source directly.

Plan:
- Confirm local Maison sources and chapter 35 rows.
- Find the MangaPlus title and chapter URLs.
- Keep reader fallback from replacing external-reader chapters with another source.
- Add focused tests for MangaPlus-vs-MangaDex target selection and external-reader fallback behavior.
- Backfill the MangaPlus source and chapter 35 row in the configured database.
- Run focused tests and full verification.

Changed:
- `src/app/api/manga/[slug]/chapter/[chapterId]/reader/route.ts`
- `tests/api/chapter-reader.route.test.ts`
- `tests/api/manga-chapters.route.test.ts`
- `docs/learnings.md`
- `docs/work-log.md`
- Added the Maison MangaPlus source `https://mangaplus.shueisha.co.jp/titles/100453` and chapter 35 viewer `https://mangaplus.shueisha.co.jp/viewer/1029242` to the configured database.

Verification:
- Queried the local database and confirmed Maison only had MangaDex chapter 35 before the backfill.
- Confirmed public references for MangaPlus title `100453` and chapter 35 viewer `1029242`; direct API checks from this environment still return the known MangaPlus `Account Banned` payload.
- Ran `npm run test -- tests/api/manga-chapters.route.test.ts tests/api/chapter-reader.route.test.ts`: 14 tests passed.
- Ran `npm run verify`: passed with 7 existing `<img>` lint warnings, 139 passing tests, and a successful production build.

Outcome:
- Maison chapter 35 now has a direct MangaPlus source/chapter row, and external-reader chapters are not substituted with another provider during reader fallback.

Learnings:
- See `docs/learnings.md`: "2026-06-05 - External Official Chapters Should Not Be Substituted".

## 2026-06-05 - Add Atsumaru Source For One Punch-Man

Why:
- The supplied Atsumaru reader URL `https://atsu.moe/read/nh6Ii/Fqt0r#rs=f:0.002189884148064425` appears to track the current One Punch-Man manga release and exposes readable page images.

Plan:
- Inspect Atsumaru app/API endpoints for metadata, chapter lists, and reader pages.
- Add an Atsumaru scraper with manual URL support and in-app reader pages.
- Register the provider, source-name inference, source ranking, and supported-source UI copy.
- Add the Atsumaru source to the configured One Punch-Man manga and populate chapters through the normal update path.
- Verify with focused tests, a live scrape, update smoke, and full verification.

Changed:
- `src/lib/scrapers/atsumaru.ts`
- `src/lib/scrapers/registry.ts`
- `src/lib/source-name.ts`
- `src/lib/chapters.ts`
- `src/lib/library-summary.ts`
- `src/components/chapter-list.tsx`
- `src/components/add-source-dialog.tsx`
- `tests/scrapers/atsumaru.test.ts`
- `tests/scrapers/provider-contract.test.ts`
- `tests/lib/source-name.test.ts`
- `README.md`
- `docs/providers.md`
- `docs/source-candidates.md`
- `docs/learnings.md`
- `docs/work-log.md`
- Added the Atsumaru source URL to the configured One Punch-Man manga.

Verification:
- Ran `npm run test -- tests/scrapers/atsumaru.test.ts tests/scrapers/provider-contract.test.ts tests/lib/source-name.test.ts`: 10 tests passed.
- Ran a live Atsumaru scrape with `npx tsx`; metadata resolved to `ONE-PUNCH MAN`, chapter 232 was returned from the linked reader URL, and the reader returned 18 pages.
- Ran the normal One Punch-Man update path with `checkForUpdates("bb344a46-b571-4761-8804-bcc1afe0c332")`: added 297 Atsumaru chapters with zero failed sources.
- Queried the configured database and confirmed the Atsumaru source has 297 chapter rows, with chapter 232 stored as `https://atsu.moe/read/nh6Ii/Fqt0r`.
- Ran a registry reader check for stored chapter 232: returned `READABLE` with 18 pages.
- Ran `npm run smoke:update`: passed. The smoke result completed the One Piece update cycle while reporting the known MangaPlus `Account Banned` source failure.
- Ran `npm run verify`: passed with 7 existing `<img>` lint warnings, 144 passing tests, and a successful production build.

Outcome:
- One Punch-Man now has the Atsumaru source and chapter rows populated in the configured database, including chapter 232 from the supplied reader URL. Atsumaru is registered for manual source URLs and can serve reader pages inside Mangateo.

Learnings:
- See `docs/learnings.md`: "2026-06-05 - Atsumaru Reader URLs Can Carry Newer Chapters Than Bulk Lists".

## 2026-06-06 - Multi-Source Explore Search

Why:
- Discovery needed to expose the app's registered provider search without turning default browsing into noisy provider-specific duplicates.

Plan:
- Keep MangaDex as the default browse feed for sorting, tags, demographics, status, and pagination.
- Switch Explore search submissions to the existing multi-source `/api/manga/search` aggregator.
- Normalize browse and search results into one card shape with source badges.
- Track multi-source search results with all returned sources.

Changed:
- `src/components/explore-page.tsx`
- `src/lib/explore/ui-results.ts`
- `tests/lib/explore-ui-results.test.ts`

Verification:
- Ran `npm run test -- tests/api/explore.route.test.ts tests/api/manga-search.route.test.ts tests/lib/explore-ui-results.test.ts`: 10 tests passed.
- Ran `npm run verify`: passed with 8 `<img>` lint warnings, 146 passing tests, and a successful production build.
- Started the local dev server and confirmed `GET /api/manga/search?q=witch%20hat%20atelier` returned 200 with 25 results.
- Browser-opened `/explore`, but full UI verification was blocked by the local auth-gated 404 without a signed-in browser session.

Outcome:
- Explore browsing remains MangaDex-backed, while submitted searches now use all registered searchable providers and render source badges. Multi-source search tracking sends the full returned source set to `/api/manga`.

Learnings:
- No reusable lesson added; this was an expected product slice using existing provider aggregation.

## 2026-06-06 - Equalize Library Manga Cards

Why:
- Library cards in later sections did not match the shorter Updates section style, and next-release estimates could sit above an empty reserved footer area instead of at the bottom of the card.

Plan:
- Keep the existing card content and section grouping.
- Preserve the shorter desktop card footprint from the Updates section.
- Remove extra equal-height row and invisible footer spacer behavior.
- Place the next-release estimate at the bottom when no action button follows it.

Changed:
- `src/components/library-dashboard.tsx`
- `src/components/manga-card.tsx`
- `docs/work-log.md`

Verification:
- Ran `npm run lint`: passed with the existing 8 `<img>` warnings.
- Ran `npm run verify`: passed with 8 `<img>` lint warnings, 146 passing tests, and a successful production build.
- Browser UI verification was not performed because the local library page is auth-gated without a signed-in browser session.

Outcome:
- Library cards reuse the shorter shared `MangaCard` layout, and caught-up/ongoing cards show the estimated next date at the card bottom instead of above a blank action slot.

Learnings:
- No reusable lesson added; this was a contained layout consistency fix.

## 2026-06-08 - Source Quality Comparison Harness

Why:
- MangaPill appears promising for manga in-app reader coverage, but provider ranking needed a repeatable comparison instead of one-off live probes.

Plan:
- Add lane-specific source quality scoring for manga, manhwa/manhua/webtoon, and single-title fallback sources.
- Add a read-only live harness that samples current providers plus MangaPill and prints ranked evidence tables.
- Record MangaPill's current candidate status and the source evaluation criteria in docs.

Changed:
- `src/lib/source-quality.ts`
- `scripts/compare-source-quality.ts`
- `tests/lib/source-quality.test.ts`
- `package.json`
- `docs/source-candidates.md`
- `docs/learnings.md`
- `docs/work-log.md`

Verification:
- Ran `npm run test -- tests/lib/source-quality.test.ts`: 3 tests passed.
- Ran `npm run test -- tests/lib/source-quality.test.ts tests/scrapers/provider-contract.test.ts`: 6 tests passed.
- Ran `npm run source:compare -- --provider=MangaPill --lane=manga`: passed; MangaPill scored 97 for manga reader and 77 for manga tracking with 100% exact matches and 100% readable samples.
- Ran `npm run source:compare`: passed; MangaPill ranked first for manga reader and manga tracking, NeloManga ranked first for manhwa/manhua/webtoon tracking, and single-title sites remained useful fallbacks.
- Ran `npm run verify`: passed with 8 existing `<img>` lint warnings, 149 passing tests, and a successful production build.

Outcome:
- Added a reusable source quality scorecard, a read-only live comparison harness, and docs that classify MangaPill as the top-priority manga reader candidate while keeping it out of the manhwa/manhua/webtoon lane.

Learnings:
- See `docs/learnings.md`: "2026-06-08 - Source Candidates Need Lane-Specific Scoring".

## 2026-06-08 - Add MangaPill Provider

Why:
- The source quality comparison showed MangaPill as the strongest manga lane candidate for in-app reader coverage.

Plan:
- Add a MangaPill scraper with search, metadata, chapter parsing, and in-app reader pages.
- Register MangaPill, infer manual source names, update source rankings, and add proxy referer handling for MangaPill CDN images.
- Update docs and supported-provider text.
- Verify with focused scraper/proxy tests, live MangaPill probes, source comparison, update smoke, and full verification.

Changed:
- `src/lib/scrapers/mangapill.ts`
- `src/lib/scrapers/registry.ts`
- `src/lib/scrapers/single-manga-sites.ts`
- `src/app/api/proxy/image/route.ts`
- `src/app/api/manga/[slug]/chapter/[chapterId]/reader/route.ts`
- `src/lib/chapters.ts`
- `src/lib/library-summary.ts`
- `src/lib/source-name.ts`
- `src/components/chapter-list.tsx`
- `src/components/add-source-dialog.tsx`
- `tests/scrapers/mangapill.test.ts`
- `tests/api/proxy-image.route.test.ts`
- `tests/scrapers/provider-contract.test.ts`
- `tests/scrapers/single-manga-sites.test.ts`
- `tests/lib/source-name.test.ts`
- `README.md`
- `docs/providers.md`
- `docs/source-candidates.md`
- `docs/work-log.md`

Verification:
- Ran `npm run test -- tests/scrapers/mangapill.test.ts tests/scrapers/provider-contract.test.ts tests/lib/source-name.test.ts tests/api/proxy-image.route.test.ts`: 11 tests passed.
- Ran `npm run test -- tests/api/manga-chapters.route.test.ts tests/api/chapter-reader.route.test.ts`: 14 tests passed.
- Ran `npm run test -- tests/scrapers/mangapill.test.ts tests/scrapers/single-manga-sites.test.ts tests/api/proxy-image.route.test.ts`: 17 tests passed.
- Ran a live registry probe for `https://mangapill.com/manga/5460/dandadan`: metadata resolved to Dandadan, 240 chapters were parsed, latest chapter 236 returned `READABLE` with 19 proxied pages.
- Ran `npm run source:compare -- --provider=MangaPill --lane=manga`: passed; MangaPill scored 97 for manga reader and 77 for manga tracking with 100% exact matches and 100% readable samples.
- Ran `npm run smoke:update`: passed. The sampled One Piece update completed with the known MangaPlus `Account Banned` source failure and no MangaPill-specific failures.
- Ran a live proxy fetch for a MangaPill page image through `/api/proxy/image`: returned 200 `image/jpeg`.
- Ran `npm run verify`: passed with 8 existing `<img>` lint warnings, 155 passing tests, and a successful production build.

Outcome:
- MangaPill is now a registered provider with search, metadata, chapter tracking, and in-app reader support. MangaPill CDN images load through the proxy with a MangaPill referer, and MangaPill is ranked above other broad manga sources for best-available and reader fallback selection.

Learnings:
- No new reusable learning yet; this implements the lane-specific candidate decision.

## 2026-06-08 - Auto-Enrich Existing Manga With MangaPill

Why:
- After adding MangaPill, already tracked manga would not show MangaPill unless the source had been manually added or the manga was re-added from search.

Plan:
- Add a conservative MangaPill discovery helper that accepts only exact title or configured alias matches.
- Run that discovery during `checkForUpdates` for manga that already have sources and do not already have MangaPill.
- Skip source overrides and avoid near-match/spinoff additions.
- Verify with focused updater/discovery tests and update smoke.

Changed:
- `src/lib/manga-updater.ts`
- `src/lib/scrapers/mangapill-discovery.ts`
- `tests/lib/manga-updater.test.ts`
- `tests/scrapers/mangapill-discovery.test.ts`
- `docs/providers.md`
- `docs/source-candidates.md`
- `docs/work-log.md`

Verification:
- Ran `npm run test -- tests/lib/manga-updater.test.ts tests/scrapers/mangapill-discovery.test.ts tests/scrapers/mangapill.test.ts`: 15 tests passed.
- Ran `npm run test -- tests/lib/source-name.test.ts tests/scrapers/provider-contract.test.ts`: 5 tests passed.
- Ran `npm run smoke:update`: passed. The sampled One Piece update auto-added MangaPill and inserted 1200 MangaPill chapters; the known MangaPlus `Account Banned` source failure remained.
- Ran `npm run verify`: passed with 8 existing `<img>` lint warnings, 160 passing tests, and a successful production build.

Outcome:
- Existing tracked manga can now automatically gain a MangaPill source during update checks when MangaPill search returns a strict title or configured-alias match.

Learnings:
- No new reusable lesson added; this extends the MangaPill provider rollout.

## 2026-06-08 - Remove Manual Add Source UI

Why:
- Source discovery should happen through search and conservative update-time enrichment instead of asking users to manually attach provider URLs from the manga detail page.

Plan:
- Remove the detail-page Add Source dialog and keep existing source display links.
- Preserve the tested backend source endpoint as a compatibility/internal path.
- Update product/audit docs to reflect automatic source enrichment as the expected flow.
- Verify with the focused route/updater tests and full project verification.

Changed:
- `src/app/manga/[slug]/page.tsx`
- `src/components/add-source-dialog.tsx`
- `docs/functional-audit-checklist.md`
- `docs/product-notes.md`
- `docs/work-log.md`

Verification:
- Ran `rg -n "AddSourceDialog|Add Source Provider|LINK SOURCE|Add Source" src tests docs README.md -S`: only the removal work-log entry remains.
- Ran `npm run test -- tests/api/source.route.test.ts tests/lib/manga-updater.test.ts`: 11 tests passed.
- Ran `npm run verify`: passed with 8 existing `<img>` lint warnings, 160 passing tests, and a successful production build.
- Attempted browser verification against `http://127.0.0.1:3000` and `http://localhost:3000`, but the in-app browser blocked both local URLs with `net::ERR_BLOCKED_BY_CLIENT`.

Outcome:
- The manga detail page no longer exposes a manual Add Source dialog. Linked sources remain visible, and source growth is documented as search-driven plus conservative update-time enrichment.

## 2026-06-08 - Demote Single-Title Sources To Fallback Priority

Why:
- Single-title manga sites were documented as fallback sources, but Houseki no Kuni still showed only the Land of the Lustrous source because older source filtering forced that single-title provider.

Plan:
- Stop filtering Houseki and other manga down to dedicated single-title sources.
- Keep single-title sources visible and scraped as fallback options.
- Rank MangaPill above single-title sources for duplicate chapter targets and library summaries.
- Add focused tests for source visibility, updater scraping, and MangaPill-over-single-title target selection.

Changed:
- `src/lib/source-overrides.ts`
- `src/lib/chapters.ts`
- `src/lib/library-summary.ts`
- `src/components/chapter-list.tsx`
- `src/app/api/manga/[slug]/chapters/route.ts`
- `tests/lib/source-overrides.test.ts`
- `tests/lib/manga-updater.test.ts`
- `tests/api/manga-chapters.route.test.ts`
- `docs/learnings.md`
- `docs/work-log.md`

Verification:
- Ran `npm run test -- tests/lib/source-overrides.test.ts tests/api/manga-chapters.route.test.ts tests/lib/manga-updater.test.ts`: 19 tests passed.
- Ran `npm run smoke:update`: passed for Hunter x Hunter (Official Colored), with no failed sources.
- Ran `npm run test -- tests/scrapers/registry.test.ts tests/lib/source-overrides.test.ts`: 5 tests passed after updating the aggregation expectation.
- Ran `npm run verify`: passed with 8 existing `<img>` lint warnings, 161 passing tests, and a successful production build.
- Queried local Houseki no Kuni sources before the targeted update: MangaDex, NeloManga, and Land of the Lustrous were already stored, but the old source filter hid the broad providers.
- Ran targeted `checkForUpdates` for local Houseki no Kuni: MangaPill was auto-added, MangaDex/NeloManga/Land of the Lustrous were scraped, and 108 new chapters were inserted with no failed sources.

Outcome:
- Houseki no Kuni now shows broad providers instead of being forced down to the Land of the Lustrous single-title source. Single-title sources remain visible and scraped as fallbacks, while MangaPill outranks them for best chapter targets and summaries.

Learnings:
- See `docs/learnings.md`: "2026-06-08 - Source Priority Must Match Across UI, SQL, and Updater Paths".

## 2026-06-10 - Fix Witch Hat Atelier Source And Reader Routing

Why:
- Witch Hat Atelier did not show MangaPill as a source locally.
- Quick read/latest actions could select a broad duplicate source instead of the dedicated Witch Hat source.
- Witch Hat chapters opened the Mangateo reader shell but did not render pages because the generic single-manga scraper rejected the source's current CDN image URLs.

Plan:
- Add regressions for Witch Hat source ranking, MangaPill alias matching, and reader image extraction.
- Share source ranking between server chapter targets and client chapter grouping, with a Witch Hat-specific dedicated-source priority.
- Keep broad sources visible in the chapter source tabs.
- Allow Witch Hat's current CDN reader images in the single-manga scraper.
- Verify the local Witch Hat page and reader in the browser.

Changed:
- `src/lib/source-preference.ts`
- `src/lib/chapters.ts`
- `src/lib/library-summary.ts`
- `src/components/chapter-list.tsx`
- `src/components/chapter-item.tsx`
- `src/lib/manga-aliases.ts`
- `src/lib/scrapers/single-manga-sites.ts`
- `tests/api/manga-chapters.route.test.ts`
- `tests/lib/source-preference.test.ts`
- `tests/scrapers/mangapill-discovery.test.ts`
- `tests/scrapers/single-manga-sites.test.ts`
- `docs/learnings.md`
- `docs/work-log.md`

Verification:
- Ran `npm run test -- tests/scrapers/single-manga-sites.test.ts tests/scrapers/mangapill-discovery.test.ts tests/api/manga-chapters.route.test.ts tests/lib/source-preference.test.ts tests/scrapers/witch-hat-atelier.test.ts tests/api/chapter-reader.route.test.ts`: 38 tests passed.
- Ran `npm run test -- tests/lib/source-preference.test.ts tests/lib/reader-routing-invariants.test.ts tests/api/manga-chapters.route.test.ts tests/scrapers/single-manga-sites.test.ts tests/scrapers/mangapill-discovery.test.ts`: 32 tests passed after adding broad regression guards.
- Ran `npm run verify`: passed with 8 existing `<img>` lint warnings, 168 passing tests, and a successful production build.
- Ran `npm run smoke:update`: passed for Hunter x Hunter (Official Colored), with no failed sources. An earlier attempt hit a transient Prisma `P1017` closed-connection error, then passed on retry.
- Browser-verified `http://localhost:3000/manga/witch-hat-atelier`: MangaPill appears in the Sources list and chapter source tabs, and Read/Latest point to `/manga/witch-hat-atelier/chapter/4b0ff784-f76e-45c4-91e9-9de04d337f28`.
- Browser-verified the Witch Hat chapter 97 reader renders 26 page images from `pic.readkakegurui.com`.
- Upserted the local MangaPill source for Witch Hat Atelier as `https://mangapill.com/manga/4553/tongari-boushi-no-atelier` so the current local library reflects the fixed discovery rule.

Outcome:
- Witch Hat Atelier's dedicated source now wins quick read/latest target selection over MangaPill, NeloManga, and Manganato duplicates.
- MangaPill is visible locally for Witch Hat and future discovery accepts MangaPill's current combined Witch Hat title.
- Stale non-readable reader metadata no longer prevents non-external sources from opening in Mangateo, and the Witch Hat reader renders current CDN pages.
- Regression guards now check that every configured single-title source is recognized as dedicated, broad providers remain visible beside dedicated fallbacks, and stale reader metadata cannot bypass retryable in-app sources.

Learnings:
- See `docs/learnings.md`: "2026-06-10 - Single-Title Reader Sources Need Live CDN Patterns".

## 2026-06-17 - Per-Manga Source Disable Controls

Why:
- Users need a way to hide a noisy or unwanted source for a specific manga without deleting the shared source or affecting other users.

Plan:
- Add a per-user/per-manga disabled-source setting.
- Add an authenticated API route to disable and reenable one source.
- Make chapter pages, chapter targets, and library summary actions ignore disabled sources.
- Add manga-detail source controls for toggling sources.
- Verify with focused route tests, lint, full verification, and a browser check when possible.

Changed:
- Added `UserMangaDisabledSource` and a migration.
- Added `PATCH /api/manga/[slug]/sources/[sourceId]`.
- Updated manga chapter loading and summary SQL to exclude disabled sources.
- Replaced the static source list on manga detail pages with enable/disable controls.
- Added focused API tests for source toggling and disabled-source filtering.

Verification:
- Ran `npm run test -- tests/api/manga-source-settings.route.test.ts tests/api/manga-chapters.route.test.ts`: 17 tests passed.
- Ran `npm run lint`: passed with 8 existing `<img>` warnings.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 178 passing tests, and a successful production build.
- Started the local dev server and opened `http://127.0.0.1:3000/manga/witch-hat-atelier` in the in-app browser. The app returned the expected auth-gated 404 without a signed-in browser session, so the visual source-toggle flow was not manually verified.

Outcome:
- Done locally. Source toggles are implemented and covered by automated route tests; browser UI verification still needs a signed-in local session.

## 2026-06-17 - Fix Premature Reader Progress Updates

Why:
- A chapter could be saved as latest-read while the user was only scrolling, before they had actually reached that chapter.
- The reader also showed repeated "Progress was not updated" popups when background auto-mark attempts failed.

Plan:
- Identify the scroll-based auto-mark condition.
- Add a focused regression for the completion calculation.
- Require loaded last-page evidence before auto-marking a chapter read.
- Keep manual progress errors visible while suppressing repeated background auto-mark popups.
- Run focused tests and broader verification.

Changed:
- `src/components/chapter-reader.tsx`
- `src/lib/reader-progress.ts`
- `tests/lib/reader-progress.test.ts`
- `docs/learnings.md`
- `docs/work-log.md`

Verification:
- Ran `npm run test -- tests/lib/reader-progress.test.ts tests/api/manga-progress.route.test.ts`: 9 tests passed.
- Ran `npm run lint`: passed with 8 existing `<img>` warnings.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 181 passing tests, and a successful production build.
- Started the local dev server and opened a known reader URL in the in-app browser. The app returned the expected auth-gated 404 without a signed-in browser session, so the scrolling reader flow was not manually verified.

Outcome:
- Done locally. Auto progress now requires loaded last-page evidence, and background auto-mark failures no longer show repeated user-facing popups.

Learnings:
- See `docs/learnings.md`: "2026-06-17 - Reader Progress Must Use Loaded Page Evidence".

## 2026-06-17 - Repair Production Library After Source Toggle Migration

Why:
- The deployed library page showed "Library unavailable / Could not load your library" after the per-manga source toggle change.
- The library summary query references `UserMangaDisabledSource`; production had the migration file in git but the configured Neon database had not applied that migration.

Plan:
- Check production/configured database migration status.
- Apply only the missing disabled-source table and constraints with idempotent SQL.
- Mark the migration as applied in Prisma's migration table.
- Verify the live app health endpoint and table availability.

Changed:
- Applied the `UserMangaDisabledSource` table, unique index, source index, and foreign keys directly to the configured Neon database.
- Marked `20260617120000_add_user_manga_disabled_sources` as applied with Prisma.
- No application code changed.

Verification:
- Ran `npx prisma migrate status`: confirmed `20260617120000_add_user_manga_disabled_sources` was initially not applied, then confirmed only older unrelated migration-history drift remains.
- Ran idempotent `npx prisma db execute --schema prisma/schema.prisma --stdin`: succeeded.
- Ran `npx prisma migrate resolve --applied 20260617120000_add_user_manga_disabled_sources`: succeeded.
- Ran a Prisma Client count against `userMangaDisabledSource`: succeeded with `0` rows.
- Probed `https://mangateo.vercel.app/api/health`: returned 200 with database ok.
- Probed unauthenticated `https://mangateo.vercel.app/api/manga/library`: returned 401, which is expected without a session.

Outcome:
- Production database now has the table required by the library summary query. Users may need to refresh the page to retry the failed client request.

## 2026-06-17 - Drag-Reorder Manga Sources

Why:
- Users need direct control over which source wins for a given manga, especially when multiple providers have duplicate chapters.

Plan:
- Store source order per user and per tracked manga.
- Add an authenticated API route to save the ordered source ids.
- Apply custom order to manga detail source display, client "Best Available" picking, server chapter targets, and library summary SQL.
- Add focused tests for the ranking helper, order route, and chapter target selection.
- Verify with focused tests, lint, and full verification.

Changed:
- Added `UserMangaSourcePreference` and a migration.
- Added `PUT /api/manga/[slug]/sources` to save source order.
- Added `src/lib/source-ranking.ts` for shared source score calculation.
- Updated manga detail sources to drag/drop reorder and save order.
- Updated chapter list, chapter target API, and library summary SQL to honor saved order.
- Added focused API and ranking tests.

Verification:
- Ran `npm run test -- tests/lib/source-ranking.test.ts tests/api/manga-source-order.route.test.ts tests/api/manga-chapters.route.test.ts`: 20 tests passed.
- Ran `npm run lint`: passed with 8 existing `<img>` warnings.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 188 passing tests, and a successful production build.
- Applied the new `UserMangaSourcePreference` table to the configured Neon database with idempotent SQL and marked `20260617140000_add_user_manga_source_preferences` as applied.
- Started the local dev server and browser-verified the signed-in Witch Hat Atelier manga page renders five source drag handles alongside the existing enable/disable controls.

Outcome:
- Done locally. Source order can be saved per tracked manga and now participates in detail-page source display, client best-source picking, server chapter targets, and library summary source selection.

## 2026-06-17 - Restore MangaDex Cover Loading

Why:
- Many library cover images stopped loading even though reader chapter images still loaded.
- Browser verification showed failed images were MangaDex cover URLs proxied through `/api/proxy/image`.

Plan:
- Reproduce the image failure in the browser and isolate whether the failure is stale metadata or proxy headers.
- Patch the smallest provider-specific proxy behavior.
- Add a focused route test for the header behavior.
- Verify with the focused test and browser image load counts.

Changed:
- Updated the image proxy to use `Mangateo/1.0` for `uploads.mangadex.org` while keeping the existing NeloManga and MangaPill header handling.
- Added a proxy route regression test for MangaDex cover headers.

Verification:
- Ran direct probes showing MangaDex cover GET requests accepted `Mangateo/1.0` and rejected the shared browser-style user agent.
- Ran `npm run test -- tests/api/proxy-image.route.test.ts`: 2 tests passed.
- Restarted the local dev server and browser-verified the library page rendered 52 images with 52 loaded and 0 failed.
- Ran `npm run verify`: passed with 8 existing `<img>` warnings, 189 passing tests, and a successful production build.

Outcome:
- Done locally. MangaDex covers load through the proxy again while other provider-specific image headers are preserved.

Learnings:
- See `docs/learnings.md`: "2026-06-17 - Image Proxy Headers Are Host-Specific".

## 2026-06-08 - Merge After the Rain Aliases And Add MangaPill

Why:
- After the Rain and Koi wa Ameagari no You ni were tracked as two separate manga even though they are the same title.
- MangaPill existed for the title, but strict MangaPill discovery rejected MangaPill's combined result title.

Plan:
- Add an alias group for After the Rain, Koi wa Ameagari no You ni, and MangaPill's combined title.
- Cover future tracking dedupe and MangaPill matching with focused tests.
- Repair the local duplicate manga records by merging sources, chapters, and user progress into the canonical After the Rain record.
- Run a targeted update so MangaPill is attached and scraped.
- Verify with focused tests, update smoke, and full verification.

Changed:
- `src/lib/manga-aliases.ts`
- `tests/api/manga.route.test.ts`
- `tests/scrapers/mangapill-discovery.test.ts`
- `docs/learnings.md`
- `docs/work-log.md`

Verification:
- Ran live MangaPill search probes for `After the Rain` and `Koi wa Ameagari no You ni`; MangaPill returned `https://mangapill.com/manga/2403/koi-wa-ameagari-no-you-ni` as `Koi wa Ameagari no You ni After the Rain`.
- Ran `npm run test -- tests/api/manga.route.test.ts tests/scrapers/mangapill-discovery.test.ts tests/scrapers/registry.test.ts`: 13 tests passed.
- Merged the local duplicate `koi-wa-ameagari-no-you-ni` manga into canonical `after-the-rain`, preserving user progress and moving MangaDex/NeloManga sources.
- Ran targeted `checkForUpdates` for local After the Rain: MangaPill was auto-added, all sources scraped successfully, and 82 MangaPill chapters were inserted.
- Removed the redundant older NeloManga `after-the-rain` source after confirming the `koi-wa-ameagari-no-you-ni` NeloManga source had one more chapter.
- Ran `npm run smoke:update`: passed for Hunter x Hunter (Official Colored), with no failed sources.
- Ran `npm run verify`: passed with 8 existing `<img>` lint warnings, 163 passing tests, and a successful production build.

Outcome:
- Future tracking now canonicalizes After the Rain and Koi wa Ameagari no You ni to one manga record, and strict MangaPill discovery accepts MangaPill's combined title. The local duplicate records were merged into `after-the-rain`, with MangaPill, MangaDex, and the better NeloManga source retained.

Learnings:
- See `docs/learnings.md`: "2026-06-08 - Alias Tables Need Combined Provider Titles".

## 2026-06-08 - Review Source Rollout Documentation

Why:
- The MangaPill/source-priority rollout was complete, but the provider and audit docs needed a pass to make sure they matched the current implementation.

Plan:
- Review recent source-related commits and scan docs/code for stale manual-source and source-priority language.
- Correct any documentation or comments that still describe removed or superseded behavior.
- Run the full verification gate after the review cleanup.

Changed:
- `docs/providers.md`
- `docs/functional-audit-checklist.md`
- `src/app/api/manga/route.ts`
- `docs/work-log.md`

Verification:
- Ran `rg -n "Title-specific manga sources when configured|duplicate \\(mangaId, sourceName\\)|checkForUpdates\\(mangaId\\)|manual entry|Add Source Provider|LINK SOURCE|AddSourceDialog" README.md docs src tests -S`: only a historical work-log verification line remains.
- Ran `npm run verify`: passed with 8 existing `<img>` lint warnings, 163 passing tests, and a successful production build.

Outcome:
- Provider priority docs now match the implementation: MangaPill ranks above single-title fallbacks for best-available selection, while `Bleach Live` remains the current title-specific exception. The audit checklist now describes alias reuse, `(mangaId, sourceUrl)` duplicate protection, and queued sync jobs.

## 2026-07-02 - Prevent Mobile Manga Card Action Overlap

Why:
- The per-manga refresh icon overlapped the quick-read chapter tag on narrow library cards.

Plan:
- Give the refresh control a dedicated position over the mobile cover image.
- Run the full verification gate and inspect the responsive card in the browser where authentication permits.

Changed:
- Moved the mobile refresh control from the card's upper-right action area to the upper-right of the cover image.

Verification:
- Ran `npm run verify`: passed with 8 existing `<img>` lint warnings, 197 passing tests, and a successful production build.
- Opened the local app at a 390x844 mobile viewport; the library remained auth-gated in the browser session, so the signed-in card could not be visually inspected end to end.
- Confirmed from the mobile card geometry that the 28px refresh control now sits within the 80px cover (`left-12 top-2`) instead of sharing the quick-read tag's upper-right area.

Outcome:
- The mobile refresh icon and quick-read chapter tag now occupy separate card regions.

## 2026-07-02 - Replace Mobile Manga Refresh Icon With Swipe To Sync

Why:
- The mobile card should stay visually clean and use a direct touch gesture for per-manga sync instead of dedicating space to a refresh icon.

Plan:
- Add a guarded right-swipe gesture that does not interfere with vertical scrolling or ordinary taps.
- Reveal a sync affordance behind the card while swiping and trigger the existing sync flow past a clear threshold.
- Keep the explicit refresh button on desktop, add focused gesture tests, and verify the signed-in mobile flow in the browser.

Changed:
- Removed the per-manga refresh icon from mobile cards while retaining it on desktop cards.
- Added an 80px right-swipe interaction with a 64px sync threshold, vertical-gesture rejection, click suppression after a swipe, and snap-back animation.
- Added focused tests for swipe direction, gesture axis, distance limiting, and the sync threshold.

Verification:
- `npm run test -- tests/lib/mobile-card-swipe.test.ts`: 3 tests passed.
- `npm run lint`: passed with 8 existing `<img>` warnings.
- Browser-verified the signed-in library at 390x844: swiping the Mad card to the right started its background sync, displayed its syncing state, returned the card to rest, and did not navigate away from the library.
- `npm run verify`: passed with 8 existing `<img>` lint warnings, 200 passing tests, and a successful production build.

Outcome:
- Mobile manga cards now sync with a deliberate right swipe and no longer show a refresh icon; desktop cards retain the explicit sync button.

## 2026-07-02 - Add Tag-Based Parental Controls

Why:
- Families need child accounts that cannot discover or open manga classified with disallowed ratings or sensitive tags.

Plan:
- Link parent and child accounts by email, persist trusted MangaDex classifications, and evaluate one server-side access policy across discovery, library, detail, chapter, reader, progress, source, and update paths.
- Provide parent-managed rating/tag settings and per-title allow/block overrides, with unclassified manga denied by default.

Changed:
- Added additive parental-link, child-policy, normalized content-tag, manga-classification, and title-override database models and applied the additive SQL directly to Neon because the existing migration history is drifted and deployment does not run migrations.
- Added the conservative `safe`-only preset with `Gore` and `Sexual Violence` blocked, plus a centralized policy evaluator and stable 403 reason codes.
- Added parent invitation, policy, unlink, and override APIs; invitations activate automatically when the invited Google account signs in.
- Added the parental-control settings page, persisted full MangaDex tags/content ratings during Explore imports and metadata refreshes, filtered child discovery/library results, disabled unclassified provider search for children, and protected direct reader/API entry points.

Verification:
- Focused policy, parental API, Explore, manga import, library, chapter, reader, next-chapter, and read-status suites passed (49 tests in the primary route regression run).
- `npm run test`: 212 tests passed across 51 files.
- `npm run build`: production build passed and included both parental-control API routes and the settings page.
- `npm run lint`: passed with the repository's 8 existing `<img>` warnings.
- Browser-verified the signed-in desktop navigation and `/settings/parental-controls` page; the invitation form rendered correctly and produced no browser console warnings or errors. No invitation was submitted during verification.

Outcome:
- Parents can link a child account and enforce conservative, server-side manga restrictions with customizable tags/ratings and per-title decisions. Child-facing denials do not reveal the sensitive classification reason.

## 2026-07-02 - Aggregate Classification Across Every Manga Source

Why:
- A shared manga can have several providers, and a restrictive tag exposed by any one of them must not be ignored.

Changed:
- Added provider classification extraction for MangaPill, Manganato, NeloManga, and Webtoon HTML metadata, including conservative rating inference for explicit tags such as `Ecchi`, `Adult`, `Erotica`, and `Hentai`.
- Added a shared refresh that calls metadata for every linked source, unions tags, records all contributing providers, and persists the strictest content rating.
- Wired classification refresh into manga imports, manual metadata refreshes, and update cycles, including newly discovered sources. Provider failures do not erase an existing classification, and providers without usable metadata do not count as safe.

Verification:
- Focused classification, provider, manga-import, and updater suites passed: 34 tests across 7 files.
- `npm run smoke:update`: passed against One Piece across NeloManga, MangaPill, MangaDex, MangaPlus, and VIZ; the known MangaPlus account-ban failure remained isolated while the update succeeded.
- The live merged One Piece record retained MangaDex's strict `suggestive` rating and union including `Gore`, so the default child policy blocks it.
- `npm run verify`: passed with 8 existing `<img>` warnings, 219 tests, and a successful production build.

Outcome:
- Every linked provider is now consulted during classification refresh, and any available restrictive provider signal affects the shared manga policy.

## 2026-07-02 - Show Chapter Release Dates On Manga Pages

Why:
- Chapter cards should make each chapter's release date visible, including a clear state when a provider does not supply one.

Plan:
- Format valid provider dates consistently and render a labeled date row on every chapter card.
- Cover valid, missing, and invalid date values with a focused unit test, then run the full verification gate and inspect the manga page in the browser.

Changed:
- Added a reusable chapter release-date formatter.
- Chapter cards now display `Released <date>` or `Date unavailable` with a calendar icon.

Verification:
- `npm run test -- tests/lib/chapter-release-date.test.ts`: 2 tests passed.
- `npm run lint`: passed with the repository's 8 existing `<img>` warnings (as the first stage of `npm run verify`).
- Browser-verified the signed-in Hunter X Hunter manga page: chapter cards rendered `Date unavailable` for the selected MangaPill chapters, whose provider data has no release dates, and the browser console had no errors.
- `npm run verify` could not complete because concurrent, unrelated content-classification/provider work in the shared worktree caused circular-import scraper failures and two manga-route test failures. Before those failures, 182 tests passed; the focused release-date test remained green. The production build stage was therefore not reached.

Outcome:
- Chapter release-date metadata is now consistently visible when available, while missing or invalid provider dates are disclosed instead of silently omitted.
