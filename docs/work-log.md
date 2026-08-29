# Work Log

## 2026-08-29 - Refine Admin Failure Diagnostics

### Why

- The account diagnosis panel made failed sync recovery hard to scan: quick insights were separated from the retry action, failure details read like dense paragraphs, and repeated summary/action content made the page harder to understand at a glance.

### Plan

- Keep one aggregate retry control near account health.
- Replace duplicate numeric cards with graph-style quick insights.
- Make issue cards easier to skim with explicit diagnostic labels and per-title actions.
- Surface stored sync errors directly in the library table rows.
- Verify focused UI invariants, lint, the full repository gate, and the changed admin page in the browser.

### Changes

- Added a top-level "Retry problem syncs" action in the account health panel.
- Replaced the old repeated totals with a visual "Quick insights" section for sync health, issue mix, and reading load.
- Reworked issue cards to show issue type, title, summary, diagnostic detail, started time, inspect, and per-title retry actions.
- Highlighted retryable library rows and displayed stored sync errors inline.
- Added an admin diagnostics UI invariant test.

### Verification

- `npm run test -- tests/lib/admin-ui-invariants.test.ts tests/lib/admin.test.ts`: passed (8 tests).
- `npx eslint src/components/admin-user-detail.tsx tests/lib/admin-ui-invariants.test.ts`: passed.
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all 278 tests passed, and the production build completed.
- Browser smoke check on `http://localhost:3000/admin/users/cmr9hrppa0001m320duua73sc` with a temporary failed sync fixture: the account health panel showed the single aggregate "Retry problem syncs" action, Quick insights showed Sync health, Issue mix, and Reading load visual panels, the stored sync error appeared, and the older duplicate "Retry all affected" action was absent.
- Mobile browser check at 390px width: the graph-style admin detail page had no page-level horizontal overflow.

### Outcome

- Admin user diagnostics now put the aggregate retry control near the top, show sync/read/failure state as glanceable charts, and keep detailed failed/stale sync records below for investigation.

## 2026-08-29 - Add Reader Logo Home Navigation

### Why

- The chapter reader had chapter and manga-detail navigation, but no direct logo link back to the homepage/library like the other app menus.

### Plan

- Add the shared app logo link to the existing reader header.
- Cover the reader navigation affordance with a small invariant test.
- Run focused verification, then the standard repository gate.

### Changes

- Added the shared `BrandLink` logo to the reader header, linking to `/`.
- Added a regression assertion that the reader keeps branded homepage navigation available.

### Verification

- `npm run test -- tests/lib/reader-routing-invariants.test.ts`: passed (3 tests).
- `npx eslint src/components/chapter-reader.tsx tests/lib/reader-routing-invariants.test.ts`: passed with the existing reader `no-img-element` warning.
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all 277 tests passed, and the production build completed.
- Browser smoke check on `http://localhost:3000` with dev parent login: a MangaPill-backed reader page showed the shared app logo link with `href="/"`, and clicking it returned to the homepage.

### Outcome

- The chapter reader now has direct branded homepage navigation without removing the existing manga-detail back link.

## 2026-07-24 - Correct Separate Noise Cover

### Why

- The separate NeloManga `Noise` row for `https://www.nelomanga.net/manga/noise_44084` reused the `NOiSE`/NeloManga `/manga/noise` thumbnail.
- The saved library row showed the wrong manga picture.

### Plan

- Replace the known duplicate search metadata with a distinct cover for Tetsuya Tsutsui's 2017 `Noise`.
- Add regression coverage so `noise_44084` does not reuse the `/manga/noise` cover.
- Repair the live database row.

### Changes

- Updated the hard-coded NeloManga known duplicate cover to the MangaDex cover for `a1ccb58d-d225-47fa-87de-1b1678f8931a`.
- Strengthened the NeloManga search test to assert the duplicate has a distinct cover URL.
- Updated the live `noise-nelomanga-noise-44084` row's `coverUrl`.

### Verification

- `npx vitest run tests/scrapers/nelomanga.test.ts`: passed (4 tests).
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all 276 tests passed, and the production build completed.

### Outcome

- The separate `Noise` entry now uses the correct 2017 `Noise` cover instead of the `NOiSE` image.

## 2026-07-23 - Save Separate NeloManga Noise In Library

### Why

- Tracking the separate NeloManga `Noise` result from `https://www.nelomanga.net/manga/noise_44084` did not create a visible second library entry.
- The add route reused the existing `noise` slug before recognizing that `noise_44084` is outside the protected `NOiSE` source override.
- The updater also treated any title named `Noise` as the protected `NOiSE` record and rediscovered MangaPill/MangaDex for the provider-distinct row.

### Plan

- Derive a provider-specific slug for outside-override same-title sources before slug lookup.
- Keep grouped search display sources, but reduce grouped `NOiSE` tracking to the verified source before saving.
- Make source overrides exact-slug-aware so distinct provider slugs are not matched by title alone after creation.
- Prevent update-cycle source discovery for provider-distinct variants of protected titles.
- Repair the live database rows and verify both `Noise` entries.

### Changes

- Added provider URL identity slugging in `POST /api/manga` for same-title sources that are outside a source override.
- Changed source override lookup to prefer the stored slug when one exists.
- Skipped automatic missing-source and single-manga-site discovery for provider-distinct variants of protected titles.
- Added API and updater regression coverage for `noise_44084`.
- Moved the misplaced NeloManga `noise_44084` source into a separate `Noise` manga row with slug `noise-nelomanga-noise-44084`.
- Removed accidental MangaPill/MangaDex sources and MangaPill chapters from the separate `Noise` row.

### Verification

- `npm run test -- tests/api/manga.route.test.ts tests/scrapers/registry.test.ts tests/lib/source-overrides.test.ts`: passed (19 tests).
- `npm run test -- tests/api/manga.route.test.ts tests/lib/manga-updater.test.ts tests/lib/source-overrides.test.ts tests/scrapers/registry.test.ts`: passed (31 tests).
- Targeted update for `noise-nelomanga-noise-44084`: scraped only NeloManga `https://www.nelomanga.net/manga/noise_44084`, returned no new chapters and no failed sources.
- Live database check: `NOiSE` has 8 chapters from MangaPill plus MangaDex metadata source; separate `Noise` has 23 chapters from only NeloManga `noise_44084`. Both are attached to the user library with `UPDATED` sync status.
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all 276 tests passed, and the production build completed.

### Outcome

- The separate NeloManga `Noise` title now appears as its own library entry and future updates should not merge it back into `NOiSE`.

## 2026-07-23 - Pin NOiSE To Verified Source

### Why

- The tracked `NOiSE` manga had chapters from two unrelated NeloManga titles that share the `noise` slug/title.
- The intended `NOiSE` source is MangaPill `https://mangapill.com/manga/3174/noise`, which has 8 chapters.

### Plan

- Add a focused source override for the ambiguous `noise` slug.
- Cover search/add and tracked-source filtering with regression tests.
- Remove the bad persisted NeloManga sources and their orphaned chapters from the live database.
- Run focused checks, update-cycle verification, then the repo verification gate.

### Changes

- Added a `noise` source override that pins search/add/update behavior to MangaPill `3174/noise`.
- Allows only MangaPill and MangaDex sources for `NOiSE`, filtering out same-title NeloManga sources.
- Added regression coverage for `NOiSE` override behavior.
- Tightened automatic missing-source discovery so same-title matches are rejected when provider and tracked authors conflict.
- Requires matching author evidence before auto-linking short ambiguous titles when the tracked manga has an author.
- Deleted the two bad NeloManga sources from the tracked `NOiSE` record and removed 47 orphaned NeloManga chapters, leaving 8 MangaPill chapters.
- Recorded the source deletion/orphaned chapter cleanup lesson in `docs/learnings.md`.

### Verification

- `npm run test -- tests/lib/source-overrides.test.ts tests/lib/manga-updater.test.ts tests/lib/source-discovery.test.ts`: passed (18 tests).
- `npx eslint src/lib/source-overrides.ts tests/lib/source-overrides.test.ts`: passed.
- `npm run test -- tests/lib/source-discovery.test.ts tests/lib/manga-updater.test.ts tests/lib/source-overrides.test.ts`: passed (20 tests).
- `npx eslint src/lib/source-discovery.ts tests/lib/source-discovery.test.ts`: passed.
- Targeted live update for `NOiSE` (`checkForUpdates("fc025e22-1b72-46fe-a90b-8c2922ba7ee1")`): scraped only MangaPill and MangaDex, returned no new chapters and no failed sources.
- Live database check after cleanup and targeted update: `NOiSE` has 8 chapters, with MangaPill `3174/noise` (8 chapters) and MangaDex (0 chapters) as the only sources.
- `npm run smoke:update`: passed; the smoke manga update completed with the known non-fatal MangaPlus 403 block recorded as one failed source.
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all 268 tests passed, and the production build completed.

### Outcome

- `NOiSE` no longer shows chapters from same-name NeloManga titles, and future update cycles should not rediscover those sources.

## 2026-07-23 - Keep Same-Name Noise Results Searchable

### Why

- Searching `noise` did not visibly show `https://www.nelomanga.net/manga/noise_44084`.
- The search aggregator collapsed ambiguous same-title results under the base `noise` key, and the `NOiSE` source override could rewrite Nelo-only `Noise` results too broadly.
- NeloManga's search endpoint returns `/manga/noise` but omits `/manga/noise_44084`, even though the chapter API supports the duplicate slug.

### Plan

- Make source overrides apply only when a result already contains an allowed source.
- Preserve ambiguous same-title search results as separate entries unless author or override identity evidence links them.
- Add the known NeloManga duplicate to `noise` search results.
- Rank exact title matches above partial matches so same-name entries are visible near the top.

### Changes

- Fixed aggregation to store separate ambiguous entries under their computed identity keys.
- Added a known search identity bridge so MangaPill `NOiSE`, MangaDex `NOiSE`, and NeloManga `/manga/noise` display as one source group.
- Added exact-query ranking before source ranking in search results.
- Added a NeloManga known-duplicate search result for `/manga/noise_44084`.
- Kept the tracking route's `NOiSE` source override active so grouped display sources are reduced to the verified MangaPill source before saving/syncing.
- Added regression tests for Nelo duplicate search, ambiguous same-title aggregation, Nelo-only override behavior, and grouped `NOiSE` tracking.

### Verification

- `npm run test -- tests/scrapers/registry.test.ts tests/scrapers/nelomanga.test.ts tests/lib/source-overrides.test.ts`: passed (13 tests).
- `npx eslint src/lib/scrapers/registry.ts src/lib/scrapers/nelomanga.ts src/lib/source-overrides.ts tests/scrapers/registry.test.ts tests/scrapers/nelomanga.test.ts tests/lib/source-overrides.test.ts`: passed.
- Live `searchScrapers("noise")` check: `NOiSE` is index 0, NeloManga `/manga/noise` is index 1, and NeloManga `/manga/noise_44084` is index 2. MangaPlus still reports the known 403 block in this environment.
- `npm run test -- tests/scrapers/registry.test.ts tests/scrapers/nelomanga.test.ts tests/lib/source-overrides.test.ts tests/api/manga.route.test.ts`: passed (22 tests).
- Live `searchScrapers("noise")` check after grouping: `NOiSE` is index 0 with MangaPill, NeloManga `/manga/noise`, and MangaDex sources; NeloManga `/manga/noise_44084` is separate at index 1. MangaPlus still reports the known 403 block in this environment.

### Outcome

- Searching `noise` now groups the same `NOiSE` manga across sources while surfacing the distinct NeloManga `noise_44084` result separately near the top.

## 2026-07-10 - Resolve Completed Status Across Linked Sources

### Why

- `After the Rain` was fully read locally but remained outside the Completed library section.
- The stored manga publication status was `ONGOING`, while the title had linked sources that can report the finished publication state.
- Some providers return `ONGOING` as a metadata fallback when status extraction misses.

### Plan

- Add a pure status selector that prefers terminal/non-active publication evidence over `ONGOING`.
- Fetch metadata across all linked sources for metadata refreshes and update checks.
- Let regular update checks repair stale publication statuses.
- Cover the disagreement behavior with focused tests.

### Changes

- Added cross-source linked metadata fetching and publication status resolution.
- Manual metadata refresh now considers all linked sources for status.
- Update checks now refresh publication status even when no new chapters are added.
- Added regression coverage for `ONGOING` plus `COMPLETED` source disagreement.

### Verification

- Ran `npm run test -- tests/lib/manga-status.test.ts tests/lib/manga-metadata.test.ts tests/lib/manga-updater.test.ts tests/lib/library-sections.test.ts tests/api/manga-owned-routes.test.ts`: 22 tests passed.
- Ran `npm run verify`: ESLint completed with the 8 existing `no-img-element` warnings, all 261 tests passed, and the production build completed.
- Ran `npm run smoke:update`: passed; MangaPlus reported the known upstream `Account Banned` response while the update cycle continued.
- Corrected the local `After the Rain` manga row to `COMPLETED` and confirmed its latest tracked chapter and last-read chapter are both `82.1`.

### Outcome

- Done. Fully read titles can be repaired into the Completed section when linked providers disagree and one source reports a terminal publication status.

### Learnings

- See [learnings.md](learnings.md#2026-07-10---publication-status-needs-cross-source-resolution).

## 2026-07-10 - Process User-Triggered Syncs Immediately

### Why

- Several library rows were stuck in `SYNCING` even though their shared jobs were merely due and `QUEUED`.
- The update routes relied on request-local `after(...)` callbacks to drain jobs, so if that callback did not run or did not get enough time, the UI waited for a later manual retrigger or daily cron.

### Plan

- Inspect the configured database state read-only to identify the stuck pattern.
- Process user-triggered single-title, library, and initial tracking syncs once before returning from the request.
- Keep the existing `after(...)` pass as a best-effort safety pass for remaining work.
- Verify the affected route behavior and the full repository gate.

### Changes

- Manual library updates now call `processQueuedSyncJobs` in the POST request and return the processing counts.
- Manual single-title updates now call `processSyncJob` before responding and return the job status.
- Initial tracking syncs now process the first job before responding and report `UPDATED` immediately when that pass completes.
- Updated route tests to assert the immediate processing pass.

### Verification

- Ran `npm run test -- tests/api/manga-updates.route.test.ts tests/api/manga-owned-routes.test.ts tests/api/manga.route.test.ts tests/lib/sync-jobs.test.ts`: 21 tests passed.
- Ran `npm run verify`: ESLint completed with the 8 existing `no-img-element` warnings, all 257 tests passed, and the production build completed.
- Read-only database inspection before repair found 5 `UserManga` rows in `SYNCING`, each with a due `QUEUED` shared job, plus one leftover active shared job.
- Drained the configured database queue in two worker passes: 6 jobs processed, 6 completed, 0 failed, 0 retrying.
- Final configured database check: all 39 `UserManga` rows are `UPDATED`, there are 0 active `QUEUED`/`RUNNING` sync jobs, and the single `FAILED` sync job is historical.

### Outcome

- Done. User-triggered syncs now perform a bounded immediate worker pass, and the configured database queue has been drained.

### Learnings

- See [learnings.md](learnings.md#2026-07-10---user-triggered-syncs-need-an-immediate-worker-pass).

## 2026-07-10 - Group Finished Caught-Up Manga By Normalized Status

### Why

- Some finished manga appeared in the Caught Up library section instead of the Completed section.
- The dashboard only recognized exact `COMPLETED`, so provider variants like `Finished` were treated as active titles.

### Plan

- Extract section grouping into a small pure helper.
- Preserve unread finished manga in Updates to Read.
- Treat fully read finished manga as completed using normalized provider status aliases.
- Cover unread completed manga and provider status aliases with focused tests.

### Changes

- Added `groupLibrarySections` for the dashboard's Updates, Caught Up, and Completed groups.
- Finished manga still go to Updates to Read when unread chapters remain.
- Fully read provider aliases such as `Finished` now group with canonical `COMPLETED` manga.

### Verification

- Ran `npm run test -- tests/lib/library-sections.test.ts`: 2 tests passed.
- Ran `npm run verify`: ESLint completed with the 8 existing `no-img-element` warnings, all 257 tests passed, and the production build completed.
- Browser smoke check confirmed the local app loads with the dev parent session. The dev library was empty, and the configured database is remote, so no fake manga records were inserted for a visual grouping check.

### Outcome

- Done. Fully read finished manga are grouped by normalized publication status, while unread finished manga remain in Updates to Read.

### Learnings

- See [learnings.md](learnings.md#2026-07-10---completed-library-grouping-needs-status-normalization-and-progress).

## 2026-07-10 - Clarify admin account issue details

### Why

- The admin account list still showed only an issue count, so an administrator could see that an account needed attention without seeing the affected title or stored sync error.
- The account detail page needed a stronger first-stop diagnostic section for each concrete problem.

### Plan

- Derive record-level issue details from the same admin health rules used by the dashboard and endpoints.
- Show visible issue summaries on the dashboard instead of relying on badge hover text.
- Add detail-page issue cards with inspect/retry affordances and supporting account facts.
- Verify the dashboard and account detail page in the browser.

### Changes

- Added typed admin issue derivation for failed syncs, stale syncs, and incomplete family links.
- Updated the admin account list to show the affected title and exact stored error/duration under the health badge, plus an "Open diagnostics" link.
- Added a "What needs attention" section on user detail pages with issue cards, inspect actions, retry actions for eligible sync rows, and extra account facts.
- Added focused coverage for issue derivation.

### Verification

- Focused admin diagnostics tests passed (7 tests).
- Focused ESLint passed on the touched admin files.
- Browser verification confirmed the account list exposes concrete issue details, the Matéo account detail page shows exact issue cards, and the safe Inspect action filters the library to the affected title.
- `npm run verify` passed: ESLint completed with the 8 existing `no-img-element` warnings, all 255 tests passed, and the production build completed.

### Outcome

- Administrators can now see what is wrong directly from the account list and drill into the specific affected title without guessing from a generic issue count.

### Learnings

- See [learnings.md](learnings.md#2026-07-10---health-badges-need-record-level-evidence).

## 2026-07-06 - Restore Berserk Chapters and Child Cover

### Why

- Berserk had synced 1,747 source chapter records, but only the four chapters previously opened by an adult were marked reader-available, so the child-safe chapter API hid the rest.
- The child cover proxy sent the MangaPill CDN its own origin as the referrer, which the CDN rejected.

### Changes

- Added a scraper-registry capability check for providers that support Mangateo's internal reader.
- After a successful source sync, mark previously unclassified chapters from reader-capable providers as readable; external-only sources remain hidden from child accounts.
- Use MangaPill's site origin as the referrer when proxying its CDN covers.
- Added a regression test for synced chapter visibility.

### Verification

- Focused updater, provider-contract, library, and chapter API suites passed (32 tests).
- Re-synced Berserk: all 1,747 chapter records across four healthy sources are now reader-available, with no source failures.
- Confirmed the MangaPill cover CDN returns a 49,952-byte JPEG with the corrected referrer.
- `npm run verify`: passed with 58 test files and 240 tests, the eight existing image-element warnings, and a successful production build.
- `npm run smoke:update`: passed; MangaPlus reported the known upstream `Account Banned` response while the update cycle continued successfully.

### Outcome

- Child accounts can see Berserk's synced chapters, and its proxied cover can load instead of rendering as a broken image.

### Learnings

- See [learnings.md](learnings.md#2026-07-06---chapter-visibility-must-follow-reader-capability).

## 2026-07-06 - Prevent Cached Manga Attachments from Sticking in Syncing

### Why

- Attaching the child account to the already-populated Berserk record added a source and queued a background refresh; the shared enqueue helper then incorrectly forced the child's library row into `SYNCING`, where it remained when the request-local worker did not run.

### Changes

- Split initial sync state from optional background source refreshes during tracking.
- Existing manga with chapters now attach as `UPDATED`; a newly added source may still receive a shared background refresh without marking the user as waiting.
- Kept genuinely new or empty manga in `SYNCING` until their initial job finishes.
- Added regression coverage that a classified child attachment to cached manga uses a shared refresh and returns an updated user-library state.

### Verification

- Focused manga-route and sync-job suites passed (14 tests).
- Focused ESLint passed.
- Processed the child's stuck Berserk job successfully; the persisted state is now `UPDATED` with no sync error and 1,747 shared chapters.
- Live child library API reports Berserk as `UPDATED`; four currently verified-readable chapters are visible to the child.
- `npm run verify`: passed with the full test suite, the eight existing image-element warnings, and a successful production build.
- `npm run smoke:update`: completed successfully; MangaPlus reported the known upstream `Account Banned` response while the update cycle continued.

### Outcome

- Reusing a populated manga no longer leaves the attaching child behind a false syncing state while a nonessential source refresh waits in the background.

## 2026-07-06 - Restore Unfiltered Child Search, Covers, and Imports

### Why

- After parental controls became tag-only, child discovery still excluded higher MangaDex rating buckets, stripped all covers, and rejected valid child catalog imports because the dialog duplicated an opaque source reference and cached manga were authorized before their trusted classification was refreshed.

### Changes

- Added all MangaDex content-rating buckets to discovery so empty blocked tags truly allow every classified result, including exact Berserk search results.
- Added policy-checked internal catalog cover URLs and taught the tracking dialog to render internal images without routing them through the external image proxy.
- Removed the legacy duplicate `sourceUrl` field for opaque child catalog imports.
- Persist trusted MangaDex classification on an existing cached manga before evaluating its child access, while retaining title overrides and tag policy enforcement.
- Added focused coverage for all-rating discovery, internal child cover URLs, opaque tracking payload normalization, and classification-before-access ordering.

### Verification

- Focused child safety, search, Explore, and manga import suites passed (20 tests).
- Focused ESLint passed with the existing add-dialog image-element warning.
- Live child search returned exact `Berserk` first with an internal cover URL; the cover loaded at 256×364 and the UI successfully reported `Berserk is tracked`.
- `npm run verify`: passed with the full test suite, the eight existing image-element warnings, and a successful production build.
- `npm run smoke:update`: completed successfully; MangaPlus reported the known upstream `Account Banned` response while the update cycle continued.

### Outcome

- With no blocked tags, child accounts can discover and track any classified MangaDex title, see its cover, and reuse cached manga without a false parental-control denial.

## 2026-07-06 - Fix Exclusion Styling and Provider Tag Noise

### Why

- Blocked-tag indicators inherited a non-red theme color and clicking produced an oversized label outline; the provider scraper also exposed `Categories` as though it were a real tag.

### Changes

- Switched blocked indicators to explicit red styling and moved keyboard focus indication onto the small indicator instead of the full label.
- Renamed the internal `provider` group to the user-facing `Other source tags` label.
- Added a shared meaningful-tag check so generic navigation labels such as Category, Categories, Genre, and Tags are rejected during extraction and hidden from existing selector data.

### Verification

- Provider classification regression suite passed (6 tests), including the new generic-label case.
- Focused ESLint passed for the changed taxonomy, classification, and settings files.
- Browser-verified the indicator computes to red, `Categories` and `Provider` are absent, and the full-label focus ring class is gone.
- `npm run verify`: passed with 57 test files and 237 tests; lint retained the eight existing image-element warnings, and the production build passed.

### Outcome

- Exclusions look explicitly red without the unwanted click border, and source-derived tags no longer expose scraper navigation noise.

### Learnings

- See [learnings.md](learnings.md#2026-07-06---provider-navigation-labels-are-not-tags).

## 2026-07-06 - Show Blocked Tags as Red Exclusions

### Why

- Native checked boxes suggest inclusion, while selected parental tags actually mean that matching manga are excluded.

### Changes

- Replaced the visible native tag checkbox with an accessible custom indicator that shows a red X when the tag is blocked.
- Kept the underlying checkbox semantics and keyboard focus behavior; the main parental-controls enable checkbox remains unchanged.

### Verification

- Focused ESLint passed for the settings component.
- Browser-verified two saved blocked tags render two red indicators with X icons, while native tag checkboxes remain visually hidden.
- `npm run verify`: passed with 57 test files and 236 tests; lint retained the eight existing image-element warnings, and the production build passed.

### Outcome

- Selected tags now visually communicate exclusion rather than inclusion.

## 2026-07-06 - Use Tags as the Sole Parental Content Rule

### Why

- Separate rating and tag controls overlapped and made it difficult to predict why a manga would be blocked.

### Changes

- Removed content-rating controls from the parental settings UI.
- Stopped legacy rating selections from affecting manga access; normalized tags are now the only configurable content rule.
- Kept the conservative rule that manga without trusted classification remain unavailable to children.
- Kept the legacy database field populated with all ratings for backward-compatible storage and API responses.

### Verification

- Focused parental policy and API suites passed (14 tests).
- Browser-verified that only the tag controls remain and saving is available without rating selections.
- `npm run verify`: passed with 57 test files and 236 tests; lint retained the eight existing image-element warnings, and the production build passed.

### Outcome

- Parents now manage one understandable source-aligned tag policy instead of two overlapping classification systems.

## 2026-07-06 - Refine Child Policy Switcher

### Why

- The first tab treatment looked disconnected from the policy card and duplicated the child name for single-child families.

### Changes

- Hide the switcher when only one child is linked and use the card heading as the sole child label.
- Restyled the multi-child switcher as a compact segmented control separated from the policy card.
- Removed the duplicate selected-tag chip list above the checkbox catalogue.

### Verification

- Browser-verified the single-child page no longer renders a redundant tab while retaining the child policy card.
- Browser-verified saved selections remain checked in the catalogue without rendering duplicate chips.
- `npm run verify`: passed with 57 test files and 236 tests; lint retained the eight existing image-element warnings, and the production build passed.

### Outcome

- Single-child families get a clean card, while multi-child families retain a visually intentional account switcher.

## 2026-07-06 - Child-safe navigation and provider privacy

### Why

- Child accounts do not manage parental settings and should neither leave Mangateo for chapters nor learn which external chapter providers back the service.

### Plan

- Remove child-only navigation and source-management UI, then enforce provider privacy and Mangateo-readable chapter selection in server payloads and direct entry points.

### Changes

- Hid the Parental controls navigation item for active children and made the settings route return not found for them.
- Removed source-management UI from child manga pages and denied child access to source preference/toggle endpoints.
- Replaced child discovery provider URLs/names with opaque `mangateo:catalog:` references; child imports now resolve the reference and re-fetch trusted classification server-side.
- Removed provider classification labels and external cover URLs from child discovery; tracked child covers now use an authenticated internal cover endpoint.
- Restricted child library summaries, chapter lists, progress targets, reader pages, and next-chapter streams to chapters already verified as `READABLE` in Mangateo.
- Replaced child chapter URLs with internal Mangateo routes, removed source IDs/names, stripped reader external URLs, and return a generic not-found response for non-readable chapters.
- Added focused coverage for opaque catalog references, trusted import resolution, readable-only queries, anonymized chapter payloads, and external-reader denial.
- Generalized lint/git ignores for generated `.next-*` development output after the first verification run found an additional test build directory.

### Verification

- Focused child-safety, search, explore, import, library, chapters, reader, next-chapter, and progress suites passed (56 tests in the final focused run).
- Focused ESLint passed for the changed security and navigation paths (existing image-element warnings remain in image-rendering components).
- Live child requests confirmed the parent navigation remains visible, child navigation omits Parental controls, direct child settings returns 404, and child search/explore payloads contain neither `mangadex` nor provider URLs.
- `npm run verify`: passed after updating the generated-output ignore and one library-route expectation (lint with 8 existing `no-img-element` warnings, full Vitest suite, and production build).
- Browser automation was unavailable because the in-app browser exposed no controllable tabs; live authenticated HTTP responses were verified instead.

### Outcome

- Child accounts remain inside Mangateo for readable chapters and no longer receive chapter-provider identities or external chapter destinations through the covered UI/API paths.

## 2026-07-06 - Child Policy Tabs and Page-Level Tag Scrolling

### Why

- The blocked-tag catalogue used a cramped nested scroll area, and rendering every child policy in one long page would become unwieldy for families with several children.

### Changes

- Removed the tag catalogue's fixed height and internal overflow so the document owns vertical scrolling.
- Added one tab per linked or pending child and render only the selected child's policy panel.
- Added tab semantics, focus management, and left/right arrow navigation.
- Expanded the tag grid to three columns on large screens to use the available page width.

### Verification

- Focused ESLint passed for the settings component.
- `npm run verify`: passed with 57 test files and 236 tests; lint retained the repository's eight existing image-element warnings, and the production build passed.
- Browser-verified the authenticated parental-control page: one selected child tab and one tab panel render, the tag catalogue has no overflow container, and the body owns vertical scrolling.
- The local test family contains one child, so switching between two real child tabs was not exercised in the browser.

### Outcome

- Long tag catalogues now scroll naturally with the page, while each child policy has its own compact tabbed workspace.

## 2026-07-06 - Selectable Source-Aligned Parental Tags

### Why

- Parents had to guess and type comma-separated tag names, while providers can use different names for the same genre.

### Plan

- Use one canonical tag vocabulary at provider ingestion and policy enforcement, and populate a searchable selector from MangaDex plus tags observed from every source.

### Changes

- Added shared tag canonicalization and aliases for common provider spelling/format differences such as `Sci-Fi` and `Science Fiction`.
- Canonicalized merged provider metadata while preferring the richer non-provider tag classification when two sources describe the same tag.
- Made parental enforcement canonicalize both saved policy tags and manga source tags, preserving compatibility with existing records.
- Replaced the free-form blocked-tag field with grouped searchable checkboxes and removable selected-tag chips.
- Added all database-observed provider tags to the parental API; the UI combines those with the complete MangaDex tag catalogue.

### Verification

- Focused classification, policy, and parental API suites passed: 19 tests.
- `npm run build`: passed, including TypeScript and production route generation.
- Full `npm run test` reached 246 passing tests and one unrelated concurrent library-route expectation failure.
- Repository lint was blocked by an unrelated concurrent `prefer-const` error in `src/app/api/manga/route.ts`; eight existing image warnings remain.
- Browser verification was attempted on an isolated local server, but the development settings route returned the existing 404 shell in that browser session, so the interactive selector flow was not verified.

### Outcome

- Parental tag choices now come from the same source metadata used for enforcement, with aliases closing common provider vocabulary gaps.

### Learnings

- See [learnings.md](learnings.md#2026-07-06---canonicalize-provider-tags-at-boundaries).

## 2026-07-06 - Safe child manga search

### Why

- Child accounts always received an empty result set from the Track New Manga search, even for content permitted by their policy.

### Plan

- Keep unclassified provider search hidden from children, but serve trusted MangaDex results after the existing policy evaluator filters ratings, tags, and title overrides.

### Changes

- Routed child searches through policy-filtered MangaDex discovery and adapted classified results to the existing tracking dialog format.
- Preserved MangaDex rating, classification source, and tags in the tracking request so the server can authorize the child import without failing closed as unclassified.
- Added regression coverage for safe classified child search results.

### Verification

- Focused search and manga-import suites passed (11 tests), and focused ESLint completed with only the existing image-element warning.
- Live child-session request for `naruto` returned 20 policy-permitted MangaDex results carrying `safe` ratings, `MANGADEX` classification, and tags.
- `npm run verify`: passed (lint with 8 existing `no-img-element` warnings, full Vitest suite, and production build).
- The dialog itself was not browser-automated because the in-app browser has not exposed controllable tabs; the live endpoint and payload path were verified directly.

### Outcome

- Child accounts can search for and track classified manga allowed by their parental policy, while unclassified multi-provider search remains adult-only.

## 2026-07-06 - Parent unlink action

### Why

- Parents could create child links but had no UI action to remove them.

### Changes

- Added an `Abandon your child` action to every active or pending child card with an inline confirmation step, cancellation, progress state, and API feedback.
- Styled the destructive action with a solid red background in both its initial and confirmation states.
- Added regression coverage confirming unlinking removes the link, child policy, and title overrides.

### Verification

- Focused parental-control API suite passed (5 tests), including unlink cleanup behavior.
- Focused ESLint passed for the settings component and API test.
- `npm run verify`: passed (lint with 8 existing `no-img-element` warnings, full Vitest suite, and production build).
- Browser verification was not completed because the in-app browser exposed no controllable tabs; the live fake-family relationship was deliberately not deleted through a blind check.

### Outcome

- Parents can remove an active child or cancel a pending invitation from the settings UI after an explicit confirmation step.

## 2026-07-06 - Remove the extension-colliding inline theme script

### Why

- The in-app browser extension replaced the root layout's inline script node before hydration, even when it used `next/script` and Dark Reader's lock metadata.

### Changes

- Removed pre-hydration theme JavaScript from the document head. The existing client-side theme selector now applies the stored or system theme immediately after hydration.

### Verification

- Focused layout/theme-selector ESLint passed.
- Confirmed neither local instance emits the custom `mangateo-theme` head script.
- `npm run verify`: passed (lint with 8 existing `no-img-element` warnings, full Vitest suite, and production build).
- The in-app browser overlay still requires a manual reload because no controllable tab was exposed.

### Outcome

- The extension no longer has an application-owned head script node to replace during hydration.

## 2026-07-06 - Use Next.js-managed pre-hydration theme script

### Why

- React 19 warned that a raw script tag returned from a React component would not execute during client rendering.

### Changes

- Replaced the raw `ThemeScript` component with an inline `next/script` entry in the root layout using a stable ID and `beforeInteractive` strategy.

### Verification

- Focused ESLint passed for the root layout and theme script module.
- Both local instances rendered the tracked `mangateo-theme` script in their initial HTML.
- `npm run verify`: passed (lint with 8 existing `no-img-element` warnings, full Vitest suite, and production build).
- Direct overlay verification remains manual because the in-app browser exposed no controllable tab during this work.

### Outcome

- Theme initialization now uses Next.js's supported pre-hydration script path instead of returning a raw script element from a React component.

## 2026-07-06 - Prevent Dark Reader hydration mismatches

### Why

- The in-app browser's Dark Reader extension modified the theme script, images, and SVG attributes before React hydrated, producing a development error overlay.

### Changes

- Added Dark Reader's page-level lock metadata. Mangateo keeps its built-in light/dark theme control while the extension no longer rewrites server-rendered markup.

### Verification

- Confirmed both local server responses include `<meta name="darkreader-lock">`.
- Focused ESLint passed for the root layout.
- `npm run verify`: passed (lint with 8 existing `no-img-element` warnings, full Vitest suite, and production build).
- Direct in-app browser verification was unavailable because no controllable tab was exposed; a manual reload remains required to confirm the extension clears the overlay.

### Outcome

- Dark Reader is instructed not to mutate Mangateo's server-rendered markup, removing the identified source of the hydration mismatch while preserving the app's own theme selector.

## 2026-07-06 - Two-port family development environment

### Why

- Host-based session separation was not dependable in the in-app browser's single browser context.

### Plan

- Run parent and child development instances on separate ports with explicit, role-specific Auth.js cookie names and build directories.

### Changes

- Replaced the single family server with coordinated parent (`localhost:3000`) and child (`localhost:3001`) Next.js processes.
- Added separate `.next-parent` and `.next-child` build directories and distinct parent/child session cookies.
- Updated role detection and local testing documentation for the two-port workflow.

### Verification

- Focused role/cookie tests passed and focused ESLint completed without findings.
- Started both development instances and used one shared cookie jar to sign in on both ports. The jar retained separate `authjs.parent-session-token` and `authjs.child-session-token` cookies; port 3000 rendered `Dev Parent` while port 3001 rendered `Dev Child`.
- The first full verification run exposed generated `.next-parent` and `.next-child` output to ESLint; added both generated directories to the existing ignore list.
- Full `npm run verify`: passed on rerun (lint with 8 existing `no-img-element` warnings, full Vitest suite, and production build).

### Outcome

- Parent and child can remain authenticated concurrently in one browser without relying on hostname cookie isolation.

## 2026-07-06 - Self-heal stale fake-family roles

### Why

- A child-origin browser that retained the earlier fake parent cookie remained signed in as the parent, even after role-specific buttons were introduced.

### Changes

- Made the development login endpoint derive its role from the request hostname instead of trusting the submitted form value.
- Added a role-switch action when a fake session does not match its current local origin.

### Verification

- Focused fake-family tests passed and focused ESLint completed without findings.
- Acceptance-checked a parent session on `127.0.0.1` and confirmed the UI offers `Switch to child`.
- Submitted a deliberately stale `role=parent` form on `127.0.0.1` and confirmed the hostname-enforced result authenticated as `Dev Child`.
- Full `npm run verify`: pending.

### Outcome

- Stale or cached local role forms now converge to the identity assigned to their hostname.

## 2026-07-06 - Keep fake family roles isolated

### Why

- Both local origins displayed both role buttons, allowing the child origin to be signed in as the parent, and creating a new test session revoked an existing browser's session.

### Changes

- Made `localhost` expose only the fake parent login and `127.0.0.1` expose only the fake child login.
- Changed fake login cleanup to remove only expired sessions instead of revoking all sessions for that role.

### Verification

- Focused role-mapping tests passed and focused ESLint completed without findings.
- Acceptance-checked the rendered forms: `localhost` submits only `parent`, while `127.0.0.1` submits only `child`.
- Created a second parent session and confirmed both the original parent cookie and the independent child cookie remained authenticated with the correct identities.
- Full `npm run verify`: passed (lint with 8 existing `no-img-element` warnings, full Vitest suite, and production build).

### Outcome

- Each origin now has an unambiguous test identity and concurrent fake sessions no longer revoke each other.

## 2026-07-06 - Fake family accounts for local testing

### Why

- The two-origin workflow still required two real Google accounts, which makes parental-control development unnecessarily cumbersome.

### Plan

- Add development-only parent and child sign-in choices that use normal database sessions and automatically provision an active family link.

### Changes

- Added development-only fake parent/child account provisioning with eight-hour Auth.js database sessions.
- Added local test-role buttons to the signed-out header; production continues to expose only the configured Google flow.
- Documented the no-Google-account family testing workflow.

### Verification

- Focused `dev-family` unit test passed and focused ESLint completed without findings.
- Acceptance-checked both origins with independent cookie jars: parent login on `localhost` returned HTTP 200 and rendered `Dev Parent`; child login on `127.0.0.1` returned HTTP 200 and rendered `Dev Child`.
- During acceptance testing, fixed the development login redirect to remain relative instead of incorrectly sending users to the `0.0.0.0` bind address.
- Full `npm run verify`: passed (lint with 8 existing `no-img-element` warnings, full Vitest suite, and production build).

### Outcome

- Fake parent and child accounts can exercise the real linked-account policy paths without Google accounts.

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

## 2026-07-06 - Clarify child unlink warning

Why:
- The destructive child-unlink action needs unmistakable styling and an explicit confirmation question before it runs.

Changed:
- Made both stages of the `Abandon your child` action explicitly red.
- Changed the inline confirmation prompt to `Are you sure you want to abandon your child?`.

Verification:
- `npx eslint src/components/parental-controls-settings.tsx`: passed.
- `npm run verify`: passed with 240 tests, a successful production build, and the repository's 8 existing `<img>` warnings.
- Browser-verified the signed-in parental-controls flow: the action rendered with a red background and white text, clicking it displayed `Are you sure you want to abandon your child?`, Cancel dismissed the prompt, and the browser console had no errors.

Outcome:
- Parents now receive a clearer destructive-action warning before a child link can be removed.

## 2026-07-06 - Preserve the selected theme in the chapter reader

Why:
- Opening a chapter as a fresh document skipped theme restoration because that logic only ran inside the theme selector, which the reader does not render.

Changed:
- Added a root-document initialization script that restores the saved theme, or the system preference when none is saved, before route content renders.
- Shared the theme storage key between initialization and the theme selector.
- Added regression coverage for restoring a saved dark theme on a fresh route load.

Verification:
- Focused theme initialization test passed.
- Focused ESLint passed.
- `npm run verify`: passed with 240 tests, a successful production build, and the repository's eight existing image-element warnings.
- Browser verification was attempted, but a duplicate local dev server produced an error overlay before a chapter could be opened; the reader flow was not counted as manually verified.

Outcome:
- Fresh route loads now restore the selected theme before the chapter reader renders.

## 2026-07-06 - Manage tracked and blocked manga per child

Why:
- Parents need to inspect each child's tracked manga, understand its metadata and tags, and explicitly block or unblock individual titles.

Plan:
- Extend the parental-controls response with the manga details needed by the parent view.
- Separate tracked and explicitly blocked manga into clear lists with direct Block and Unblock actions.
- Cover the response contract with an API test and verify the complete interaction in the browser.

Changed:
- Added slug, cover, author, status, and description fields to each child's tracked-title response alongside classification, tags, and title decisions.
- Replaced the generic title-decision selector with detailed tracked-manga cards and a dedicated blocked-manga list.
- Added direct Block and Unblock actions while retaining a way to return previously always-allowed titles to the normal policy.

Verification:
- `npm run test -- tests/api/parental-controls.route.test.ts`: 7 tests passed.
- Focused ESLint for the component, parental API, and API test passed.
- Browser-verified the parent view for Dev Child: Berserk displayed its status, rating, and tags; Block moved it to the blocked list; Unblock returned it to tracked manga; both actions showed the success status and the browser console had no errors.
- `npm run verify`: lint completed with the repository's 8 existing `<img>` warnings, all 241 tests passed, and the production build completed; the command wrapper reached its 120-second ceiling immediately after Next printed the completed route manifest.
- `npm run build`: passed separately with a clean exit.

Outcome:
- Parents can now inspect a child's tracked manga and manage a clear, reversible per-title block list.

## 2026-07-06 - Tolerate extension mutation of the theme script

Why:
- A browser extension mutated the root layout's inline theme script before React hydrated it, producing a hydration mismatch on the parental-controls page.

Changed:
- Scoped `suppressHydrationWarning` to the inline theme initialization script so extension-added attributes or content do not trigger a React mismatch.
- Added a regression check that keeps the suppression on that script.

Verification:
- `npm run test -- tests/lib/theme-init.test.ts`: 2 tests passed, including the new layout regression check.
- Focused ESLint for the layout and theme test passed.
- Browser-verified a fresh `/settings/parental-controls` load with the extension present: the saved dark theme was restored, the page rendered, and the console contained no errors.
- `npm run verify`: passed with 242 tests, a successful production build, and the repository's 8 existing `<img>` warnings.

Outcome:
- Browser extensions can mutate the inline theme script without producing a hydration warning, while early theme restoration remains intact.
## 2026-07-08 - Add the initial administrator role

### Why

- The application had no first-class authorization role for administrative functionality.
- Promote Matéo's existing account so future admin-only capabilities have a stable identity to authorize.

### Plan

- Add explicit `USER` and `ADMIN` roles with safe defaults.
- Include the persisted role in Auth.js sessions.
- Promote the existing Matéo account during migration and verify the repository gate.

### Changes

- Added the `UserRole` Prisma enum and a required `User.role` field defaulting to `USER`.
- Added a data migration that promotes `mateo.parache@gmail.com` to `ADMIN`.
- Exposed the role on the typed authenticated session user.

### Verification

- `npm run verify` passed: ESLint completed with 8 pre-existing `no-img-element` warnings, all tests passed, and the production build completed.
- Prisma Client generation completed successfully.
- A live schema diff confirmed the previously unrecorded parental-control migration was already fully represented before its history was resolved.
- `prisma migrate deploy` applied the user-role migration successfully.
- A direct database read confirmed Matéo's account has role `ADMIN`.

### Outcome

- The role model and authenticated-session plumbing are verified, the database migration is live, and Matéo is an administrator.

### Learnings

- See [learnings.md](learnings.md#2026-07-08---audit-schema-before-resolving-migration-drift).
## 2026-07-08 - Add the administrator dashboard

### Why

- Administrators had a persisted role but no protected application surface for operational visibility.

### Plan

- Enforce administrator access on the server.
- Add useful system and account summaries.
- Expose the page in navigation only for administrators and verify the flow locally.

### Changes

- Added a reusable admin-role predicate with focused authorization coverage.
- Added a protected `/admin` dashboard with user, manga, chapter, source, and active-sync totals.
- Added an account overview containing roles, library sizes, and active session counts.
- Added an admin-only primary-navigation item.

### Verification

- Focused admin authorization tests passed (2 tests).
- Focused ESLint passed without findings.
- Local browser verification confirmed the admin-only navigation item, dashboard metrics, and all 11 account rows using an isolated development admin session.
- `npm run verify` passed: ESLint completed with the 8 existing `no-img-element` warnings, all tests passed, and the production build completed.

### Outcome

- Administrators have a useful, server-protected operational dashboard; regular and unauthenticated users fail the shared role check.
## 2026-07-08 - Add administrator account detail views

### Why

- The admin dashboard summarized accounts but did not let an administrator inspect an individual account's activity or library.

### Plan

- Link dashboard account rows to protected detail pages.
- Show account metadata, activity, family relationships, and reading state without exposing authentication secrets.
- Verify normal and family-linked accounts in the browser.

### Changes

- Added `/admin/users/[id]`, protected by the existing server-side administrator check.
- Added identity, role, provider, email-verification, session, reading, chat, and sync summaries.
- Added navigable parent/child relationships and a full library table with reading progress, preferred source, sync state, and last-read date.
- Linked account names on the admin dashboard to their detail pages.

### Verification

- Focused ESLint passed without findings.
- Focused administrator authorization tests passed (2 tests).
- Production build passed and included the dynamic `/admin/users/[id]` route.
- Local browser verification covered a regular account with library data and a child account with a navigable parent connection.
- `npm run verify` passed from a clean generated cache: ESLint completed with the 8 existing `no-img-element` warnings, all tests passed, and the production build completed.

### Outcome

- Administrators can inspect each account from the dashboard without exposing provider account identifiers, session tokens, or other credentials.

### Learnings

- See [learnings.md](learnings.md#2026-07-08---clean-interrupted-nextjs-development-artifacts).
## 2026-07-08 - Refine admin account support and diagnostics

### Why

- Account pages exposed raw totals but did not explain health, reveal actionable support problems, or provide guarded recovery controls.

### Plan

- Centralize health, staleness, activity, and ordering rules.
- Add protected role, session, sync-retry, and family-unlink operations.
- Refine the dashboard and account view around support decisions, explicit activity, and child-access diagnostics.

### Changes

- Added attention-first account search and role/health filters with unread and last-read signals.
- Rebuilt account details around an account-health summary plus Library, Activity & sync, and Family & access tabs.
- Reused the user-facing library summary for unread/progress data and separated explicit user activity from background timestamps.
- Added preferred-source failures, title access reasons, relevant shared/user-attributed jobs, child policy details, and guarded management controls.
- Added admin APIs for role changes, session revocation, eligible sync retries, and family unlinking, including self-lockout and final-admin protection.

### Verification

- Focused admin logic and route suites passed (12 tests).
- Focused ESLint and the production build passed.
- Browser verification covered account search, healthy and attention states, every tab, parent/child policy views, current-admin control protection, and a 390px mobile viewport without page-level horizontal overflow.
- Destructive browser actions were intentionally not submitted; route tests cover their server behavior.
- `npm run verify` passed: ESLint completed with the 8 existing `no-img-element` warnings, all tests passed, and the production build completed.
- `npm run smoke:update` passed; MangaPlus reported the known upstream `Account Banned` response while the update cycle continued successfully.

### Outcome

- Administrators can understand account health, diagnose reading and sync problems, inspect family access, and perform narrowly guarded recovery and account-management actions.

### Learnings

- See [learnings.md](learnings.md#2026-07-08---compute-time-sensitive-diagnostics-on-the-server).

## 2026-07-10 - Prioritize MangaPill on Discovery

### Why

- Discovery search could feel MangaDex-centered even though MangaPill is the preferred provider for tracking and reading.

### Plan

- Keep MangaDex browse filters where its catalog API is still required.
- Prioritize MangaPill within cross-source search results.
- Update Discovery page language so the provider split is clear.

### Changes

- Ranked aggregated search sources and result ordering with the existing source-preference table, putting MangaPill ahead of MangaDex when both match.
- Preferred higher-ranked provider metadata during merged search aggregation when that provider supplies cover, description, status, or author data.
- Updated Discovery page copy and search placeholder to present MangaPill-first search while identifying MangaDex-only catalog filters.
- Added `/api/search/manga` as the Discovery search endpoint to avoid the contested `/api/manga/[slug]` route neighborhood returning HTML 404s for search requests in the running app.
- Added a registry aggregation regression test for MangaPill-first result/source ordering.

### Verification

- `npm run test -- tests/scrapers/registry.test.ts`: passed (3 tests).
- `npm run test -- tests/api/explore.route.test.ts tests/api/manga-search.route.test.ts`: passed (9 tests).
- `npm run test -- tests/scrapers/registry.test.ts tests/api/explore.route.test.ts tests/api/manga-search.route.test.ts`: passed (12 tests) after adding the search endpoint alias.
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all tests passed, and the production build completed.
- Browser-verified `/explore` on `http://localhost:3010`: new MangaPill-first copy and search placeholder rendered, MangaDex browse results loaded, and page-level horizontal overflow was absent.
- Browser check found `/api/manga/search` returned an HTML 404 in the running dev app; `/api/search/manga` returned JSON (`401` when called without a browser session), so Discovery was moved to the JSON endpoint.

### Outcome

- Discovery search now favors MangaPill without removing the MangaDex catalog browsing path that powers sort, category, demographic, and status filters.

## 2026-07-10 - Make Discovery Default To MangaPill

### Why

- The Discovery page still opened on MangaDex browse cards, so users saw MangaDex source badges and MangaDex-derived tags before searching.

### Plan

- Add a MangaPill browse feed for the default Discovery grid.
- Keep filtered catalog browsing available as an explicit alternate mode.
- Verify the default page no longer shows MangaDex source/tag pills.

### Changes

- Added a MangaPill explore parser and `/api/explore/mangapill`, using MangaPill homepage trending cards.
- Changed the Discovery client to default to MangaPill browse mode and hide catalog filters unless the filtered catalog mode is selected.
- Removed visible MangaDex wording from the default Discovery controls and helper copy.
- Generalized browse result normalization so MangaPill and catalog browse results share the card renderer.
- Added a parser regression test proving MangaPill browse cards carry MangaPill sources and no MangaDex tags.

### Verification

- `npm run test -- tests/lib/explore-mangapill.test.ts`: passed (1 test).
- `npm run test -- tests/api/explore.route.test.ts tests/api/manga-search.route.test.ts tests/scrapers/registry.test.ts`: passed (12 tests).
- Focused ESLint passed with only the existing Explore image warnings.
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all tests passed, and the production build completed.
- Browser-verified `http://localhost:3010/explore`: default grid loaded 10 MangaPill cards, no visible `MANGADEX` or `MangaDex` text appeared, and page-level horizontal overflow was absent.

### Outcome

- Discovery now opens on MangaPill content. MangaDex-derived tags/source badges only appear after explicitly switching into filtered catalog browsing.

## 2026-07-10 - Expand MangaPill Discovery Filters

### Why

- MangaPill Discovery still behaved like a homepage strip: only 10 suggestions loaded, MangaPill browse filters were missing, and mature category requests could not apply to MangaPill suggestions.

### Plan

- Use MangaPill catalog/search pages instead of only the homepage trending section.
- Add MangaPill category, type, status, and paging parameters to the Discovery API and UI.
- Add mature category aliases that map onto MangaPill's real available genres.
- Verify parsing against tests and live MangaPill markup.

### Changes

- Added MangaPill search URL building for catalog, newly added, category, type, status, limit, and offset inputs.
- Added MangaPill category controls to Discovery, including Porn, Hentai, Erotica aliases, Ecchi, Doujinshi, Yaoi, Yuri, and the full verified MangaPill genre set.
- Changed MangaPill browse to fetch multiple catalog pages up to the requested window, enabling the same Load more flow that MangaDex browse had.
- Parsed MangaPill genre chips from search result cards while avoiding alternate titles being treated as tags.
- Preserved MangaDex filtered catalog mode as the explicit fallback for MangaDex-specific browsing.

### Verification

- `npm run test -- tests/lib/explore-mangapill.test.ts`: passed (2 tests).
- Focused ESLint for Explore, MangaPill explore, and the MangaPill explore API passed with the existing Explore `no-img-element` warnings.
- Live MangaPill provider check for the Hentai alias built `https://mangapill.com/search?q=&genre=Ecchi`, returned HTTP 200, parsed 50 MangaPill cards, and parsed real tags such as Comedy, Ecchi, Romance, and Seinen.
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all 264 tests passed, and the production build completed.
- Browser opened `http://localhost:3010/explore`, but the local app returned the auth-protected 404 because the in-app browser had no signed-in session; authenticated visual verification was not completed in-browser.

### Outcome

- MangaPill Discovery now uses provider catalog pages with filters and pagination instead of being capped by MangaPill's 10-card homepage strip.

### Learnings

- See [learnings.md](learnings.md#2026-07-10---mangapill-search-filters-are-conjunctive).

## 2026-07-10 - Fix Empty MangaPill Category Results

### Why

- Selecting a MangaPill category could produce an empty grid when the stale Doujinshi type filter was also active.

### Plan

- Reproduce the provider combination.
- Avoid sending MangaPill's `type=doujinshi` alongside category filters.
- Keep Doujinshi available as a category filter, where MangaPill returns results.

### Changes

- Removed Doujinshi from the MangaPill type dropdown while keeping the Doujinshi category.
- Cleared a stale Doujinshi type when a MangaPill category is selected.
- Hardened the MangaPill URL builder to ignore stale `type=doujinshi` whenever a category is present.
- Added a regression assertion for the previously-empty URL shape.

### Verification

- `npm run test -- tests/lib/explore-mangapill.test.ts`: passed (2 tests).
- Focused ESLint for Explore and MangaPill explore passed with the existing Explore `no-img-element` warnings.
- Live MangaPill provider check for `{ genre: "adult-hentai", type: "doujinshi", status: "completed" }` built `https://mangapill.com/search?q=&status=finished&genre=Ecchi`, returned HTTP 200, and parsed 50 cards.

### Outcome

- Category selection no longer gets emptied by the incompatible Doujinshi type intersection.

## 2026-07-10 - Fix Empty MangaPill Default Browse

### Why

- MangaPill Browse could still show an empty grid with All categories, All types, and All statuses selected.

### Plan

- Verify the unfiltered provider URL used by the default feed.
- Point the default feed at a MangaPill listing page that actually returns paginated cards.
- Keep category/type/status filters on MangaPill search.

### Changes

- Changed the no-filter MangaPill browse URL from `/search?q=` to `/mangas/new`.
- Removed the duplicate MangaPill sort tab so the default browse control reflects the one reliable unfiltered listing.
- Added a regression assertion for the all-filters-empty URL.

### Verification

- `npm run test -- tests/lib/explore-mangapill.test.ts`: passed (2 tests).
- Focused ESLint for Explore and MangaPill explore passed with the existing Explore `no-img-element` warnings.
- Live MangaPill provider check for `{ sort: "trending", limit: "24", offset: "0" }` built `https://mangapill.com/mangas/new`, returned HTTP 200, and parsed 50 cards.

### Outcome

- The default MangaPill Discover view no longer points at MangaPill's empty unfiltered search page.

## 2026-07-10 - Merge Discovery Sources And Filters

### Why

- Discovery still forced users to choose between MangaPill browse and the filtered catalog, even though the intended experience is one MangaPill-prioritized page with the broader catalog filters available.

### Plan

- Remove the browse-source toggle.
- Fetch MangaPill and MangaDex browse data together for the single Discover grid.
- Translate shared filters to each provider and avoid adding unrelated provider results when a selected category only exists on one provider.
- Merge duplicate titles while keeping MangaPill ordering and adding secondary sources.

### Changes

- Replaced the MangaPill / filtered catalog tabs with one shared sort, category, demographic, and status control set.
- Built a combined category list from MangaPill genres/adult aliases plus MangaDex tags, matching shared labels to both providers.
- Fetches MangaPill and MangaDex in parallel, merges results by slug, keeps MangaPill first, and appends unique sources/tags from duplicates.
- Applies demographics to MangaDex directly and to MangaPill when they have genre equivalents such as Shounen, Shoujo, Seinen, and Josei.
- Skips provider calls for category filters that have no equivalent on that provider, preventing unrelated cards from leaking into filtered views.

### Verification

- `npm run test -- tests/lib/explore-ui-results.test.ts tests/lib/explore-mangapill.test.ts`: passed (4 tests).
- Focused ESLint for Explore and UI result helpers passed with the existing Explore `no-img-element` warnings.
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all 264 tests passed, and the production build completed.
- Browser-verified `http://localhost:3000/explore` with dev parent login: the source toggle was gone, the merged filter controls rendered, default browse loaded 48 cards, no `No manga found` state appeared, and page-level horizontal overflow was absent.
- Browser-selected the Action category: the grid refreshed to 46 cards with both MangaPill and MangaDex sources visible, no error or empty state, and no page-level horizontal overflow.

### Outcome

- Discover is now a single MangaPill-prioritized mixed-source browse page with the filtered catalog controls folded into the same experience.

## 2026-07-17 - Stabilize Search And Reader Loading

### Why

- Searching for titles such as `noise` or `gyges` could show an empty result state even when the providers returned matches.
- Reader loading also felt slow/not loaded, suggesting a broader provider/network pressure issue rather than only a search parser problem.
- The add dialog treated failed requests and stale responses the same as a legitimate empty search.
- The reader prefetch path could start fetching many proxied images in the background while visible pages were still loading.
- Browser verification found reader API failures could also render as raw JSON parse/null errors or a blank chapter shell instead of a source-link fallback.

### Plan

- Reproduce the search path directly against registered providers.
- Prevent older in-flight search requests from overwriting the current query.
- Surface search failures separately from "No results found".
- Reduce reader background image prefetch pressure so visible pages have less competition.
- Make reader fetch/display handling defensive for non-JSON errors and empty page lists.
- Verify with focused checks and live provider searches.

### Changes

- Added per-query request cancellation to the add manga dialog search effect.
- Clears stale results and errors when the query becomes shorter than the searchable threshold.
- Displays a "Search failed" state with the route error instead of silently falling through to "No results found".
- Limited current and adjacent reader chapter image prefetches to the first few pages instead of an entire chapter.
- Reader fetch now handles non-JSON failed responses without throwing parse/null exceptions.
- Reader display now treats `READABLE` with zero pages as a source-link fallback instead of rendering an empty chapter.
- Recorded stale-response search and reader-fallback lessons in `docs/learnings.md`.

### Verification

- `npx eslint src/components/add-manga-dialog.tsx src/components/chapter-reader.tsx src/lib/reader-prefetch.ts src/app/api/proxy/image/route.ts`: passed with existing `no-img-element` warnings.
- `npm run test -- tests/api/manga-search.route.test.ts tests/api/chapter-reader.route.test.ts tests/api/proxy-image.route.test.ts tests/scrapers/registry.test.ts tests/scrapers/mangapill.test.ts tests/scrapers/mangadex.test.ts`: passed (25 tests).
- Live scraper check with `searchScrapers("noise")` returned 30 results headed by `NOiSE`; `searchScrapers("gyges")` returned `Gyges no Futari`. MangaPlus still reports the known upstream `Account Banned` block from this environment.
- Browser-verified the signed-in add manga dialog at `http://localhost:3000`: `gyges` rendered `Gyges no Futari`, and `noise` rendered results headed by `NOiSE` without the no-results or search-failed state.
- Browser-verified an existing reader route: failed MangaPill reader API responses no longer surfaced JSON parse/null exceptions, and the chapter sections rendered the source-link fallback with `Reader failed: 404`.
- `npm run verify`: passed after stopping the local dev server and removing the generated `.next/dev` artifact; ESLint completed with the existing 8 `no-img-element` warnings, all 266 tests passed, and the production build completed.

### Outcome

- Add manga search is more resistant to stale and failed requests, and the reported `noise` / `gyges` searches return visible results locally.
- Reader loading is less aggressive with background image prefetching and now degrades to a source-link fallback instead of raw errors or a blank shell when provider/API loading fails.

## 2026-07-10 - Interleave Discovery Sources

### Why

- The unified Discover page fetched both MangaPill and MangaDex, but MangaPill's full page appeared first, making the visible grid still look MangaPill-only.

### Plan

- Interleave provider result groups instead of appending MangaDex after MangaPill.
- Keep duplicate-title merging so shared titles still show multiple sources on one card.
- Cover the ordering behavior with a focused unit test.

### Changes

- Moved browse result merging into the shared Explore UI result helper.
- Changed merged browse ordering to round-robin result groups, keeping MangaPill first while surfacing MangaDex immediately.
- Kept duplicate slugs merged with unique sources/tags and tracked state preserved.
- Updated Discover helper copy to describe interleaved MangaPill and catalog results.

### Verification

- `npm run test -- tests/lib/explore-ui-results.test.ts`: passed (3 tests).
- Focused ESLint for Explore, UI result helpers, and the Explore UI result test passed with the existing Explore `no-img-element` warnings.
- `npm run verify`: passed; ESLint completed with the existing 8 `no-img-element` warnings, all 265 tests passed, and the production build completed.
- Browser-verified `http://localhost:3000/explore` with dev parent login: default browse loaded 48 cards, the first 12 cards alternated MangaPill and MangaDex sources, the old filtered-catalog toggle was absent, no empty state appeared, and page-level horizontal overflow was absent.

### Outcome

- Mixed Discover results now show more than MangaPill in the first visible result sequence.

## 2026-07-10 - Apply Mature Discovery Filters To MangaDex

### Why

- Mature category filters such as Porn, Hentai, Erotica, and Ecchi still behaved MangaPill-only because MangaDex models those as content ratings rather than genre tags.

### Plan

- Add content-rating filtering to the MangaDex explore API.
- Map mature UI categories to MangaDex content ratings while keeping MangaPill genre aliases.
- Cover the provider mapping and API URL generation with focused tests.

### Changes

- Added `contentRating` support to MangaDex explore queries and route parameter forwarding.
- Changed MangaDex URL construction to use selected content ratings when present instead of always sending all ratings.
- Mapped Porn/Hentai to `pornographic`, Erotica to `erotica`, Erotic/adult to `erotica,pornographic`, and Ecchi to `suggestive,erotica` for MangaDex.
- Moved category option construction into the shared Explore UI helper and added regression coverage for shared and mature category mappings.

### Verification

- `npm run test -- tests/api/explore.route.test.ts tests/lib/explore-ui-results.test.ts`: passed (9 tests).
- Focused ESLint for Explore, MangaDex explore, UI result helpers, routes, and tests passed with the existing Explore `no-img-element` warnings.
- `npm run verify`: passed (lint, 266 tests, production build). Lint still reports the existing `no-img-element` warnings.
- Browser check on family dev: selected the Porn category on `/explore` and confirmed the rendered results were not empty and included interleaved MangaPill and MangaDex cards.

### Outcome

- Mature Discover filters now apply to MangaDex/catalog results as well as MangaPill wherever provider semantics support it.
