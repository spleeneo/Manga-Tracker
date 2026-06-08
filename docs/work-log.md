# Work Log

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
