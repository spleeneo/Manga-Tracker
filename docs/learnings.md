# Learnings Log

## 2026-07-10 - Publication Status Needs Cross-Source Resolution

Context:
- Fully read finished manga can stay out of the Completed library section when one provider returns `ONGOING` as a fallback and a later linked provider has the actual terminal status.

Learning:
- Provider `ONGOING` values are sometimes selector fallbacks rather than strong publication evidence.

Action:
- Resolve publication status across linked metadata sources and prefer terminal/non-active statuses over `ONGOING` when sources disagree.

## 2026-07-10 - User-Triggered Syncs Need An Immediate Worker Pass

Context:
- User-triggered library updates marked rows `SYNCING` and created due `QUEUED` jobs, but the request-local background callback did not always drain those jobs.

Learning:
- For user-visible synchronization, enqueueing work is not enough; the request that changes visible state should make a bounded worker pass before returning.

Action:
- Process newly queued sync jobs once in manual update and initial tracking routes, while keeping background and cron processing as safety nets.

## 2026-07-10 - Completed Library Grouping Needs Status Normalization And Progress

Context:
- The Completed library section filtered for manga that were both exactly `COMPLETED` and fully read, which left provider variants such as `Finished` in Caught Up.

Learning:
- The Completed section is for fully read finished series. Its status check should use normalized provider status aliases, but it must still respect unread chapter progress.

Action:
- Keep section grouping in a pure helper with regression coverage for unread completed titles and caught-up provider status aliases.

## 2026-07-10 - Health Badges Need Record-Level Evidence

Context:
- The admin dashboard correctly flagged accounts needing attention, but the visible badge stopped at "1 issue" and hid the affected record and error details.

Learning:
- Support health summaries should keep a visible path back to the specific record, stored error, and timing evidence that caused the status.

Action:
- Build typed issue details from shared diagnostics and render the concrete title, reason, and stored error/duration wherever an admin health badge is shown.

## 2026-07-08 - Compute Time-Sensitive Diagnostics On The Server

Context:
- React's purity rules rejected a client render that called `Date.now()` to decide whether a synchronization was stale.

Learning:
- Support diagnostics should be computed once on the server and passed as explicit state; this keeps hydration deterministic and ensures API eligibility rules and UI presentation share the same clock-based policy.

Action:
- Use the shared `isRetryableSync` helper server-side and send a `retryable` flag to interactive components.

## 2026-07-08 - Clean Interrupted Next.js Development Artifacts

Context:
- Stopping the local development server during UI verification left `.next/dev/types/routes.d.ts` partially written, causing the next production type-check to fail on malformed generated code.

Learning:
- A syntax error inside generated `.next/dev` route types after an interrupted dev server can be stale build output rather than a source regression.

Action:
- Confirm the error is confined to `.next`, remove only that generated cache, and rerun the full verification gate from a clean build state.

## 2026-07-08 - Audit Schema Before Resolving Migration Drift

Context:
- The production parental-control schema existed, but its migration was absent from Prisma's applied history, so a later deploy stopped on a duplicate column.

Learning:
- A failed migration can be marked applied only after a schema diff confirms every object it owns is already present; table presence alone is not sufficient evidence.

Action:
- Before resolving an already-provisioned migration, compare the live database with the Prisma schema and preserve any unrelated drift for separate work.

## 2026-07-06 - Chapter Visibility Must Follow Reader Capability

Context:
- Child chapter payloads correctly hid unverified external links, but synced chapters stayed unclassified until somebody opened them, making almost an entire manga appear empty.

Learning:
- A provider-level internal-reader contract is sufficient to expose its successfully synced chapters; waiting for per-chapter reads creates a visibility deadlock.

Action:
- Mark chapters from registered reader-capable providers readable after a successful sync, while continuing to hide external-only providers and recording real reader failures when encountered.

## 2026-07-06 - Provider Navigation Labels Are Not Tags

Context:
- Genre links scraped from provider pages included generic navigation entries such as `Categories` in the parental-control taxonomy.

Learning:
- URL shape alone does not prove linked text is classification metadata; generic section labels must be rejected at ingestion and presentation boundaries.

Action:
- Use the shared meaningful-tag predicate whenever provider tags are extracted or presented.

## 2026-07-06 - Provider Privacy Must Be Enforced In Payloads

Context:
- Hiding a source list still left provider names and URLs in discovery results, chapter payloads, library read targets, cover URLs, and direct reader fallbacks.

Learning:
- UI hiding is not a privacy boundary. Child-safe provider privacy requires opaque discovery references, trusted server-side resolution, internal media/read routes, and filtering at every payload and direct entry point.

Action:
- Keep child provider identities server-only and add regression assertions that child JSON does not contain upstream names or URLs.

## 2026-07-06 - Canonicalize Provider Tags at Boundaries

Context:
- Manga sources use spelling and formatting variants for equivalent genres, while saved parental policies and existing manga already contain raw names.

Learning:
- Canonicalizing during ingestion and comparison provides a shared taxonomy without requiring a destructive migration of existing records.

Action:
- Add provider vocabulary aliases to the shared taxonomy and use canonical keys whenever tags are merged or compared.

## 2026-07-06 - Suppression Cannot Repair Extension-Replaced Script Nodes

Context:
- An in-app browser extension replaced an application-owned head script before hydration; both raw React scripts and `next/script` produced the same mismatch.

Learning:
- When an extension replaces a DOM node rather than merely adding attributes, hydration suppression and script wrappers do not make the server/client trees equivalent.

Action:
- Avoid a pre-hydration inline script when the browser surface is known to replace it; initialize nonessential preferences after hydration instead.

## 2026-07-06 - Theme Extensions Can Cause Hydration Mismatches

Context:
- Dark Reader injected a replacement script plus inline attributes into server-rendered images and SVGs before React hydration.

Learning:
- An application-owned theme system can conflict with browser-side recoloring extensions and create noisy development-only hydration overlays even when the application markup is deterministic.

Action:
- Use Dark Reader's page-level lock metadata when the application already owns theme switching.

Use this file to capture reusable lessons from development, debugging, production issues, and AI-assisted work. Keep entries short and practical.

Add a note when:

- A bug reveals a missing test, unclear assumption, or fragile code path.
- A provider, API, or framework behaves differently than expected.
- A verification step catches something important.
- A repeated development mistake suggests a new rule or checklist item.
- A useful pattern should be reused later.
- A work-log entry reveals a decision, broken assumption, or delivery issue worth remembering.

Entry format:

```markdown
## YYYY-MM-DD - Short Title

Context:
- What were we trying to do?

Learning:
- What should we remember next time?

Action:
- Test, checklist item, code pattern, documentation update, or follow-up task.
```

## 2026-06-02 - Development Methodology Should Be Enforced

Context:
- We wanted to reduce cases where code changes appear complete but fail during real use.

Learning:
- A methodology is only useful when it is visible in the repo and connected to the normal development path.

Action:
- Added `docs/development-methodology.md`, `AGENTS.md`, a PR checklist, `npm run verify`, and CI verification.

## 2026-06-02 - Work Needs A Durable Trace

Context:
- We wanted future work to be resumable and future regressions easier to diagnose.

Learning:
- Conversation history is not enough project memory. Meaningful work should record why it happened, the plan, changed areas, verification, outcome, and any lessons learned.

Action:
- Added `docs/work-log.md` and linked it from the methodology, agent instructions, README, and PR checklist.

## 2026-06-02 - Chapter Targets Must Reuse Source Preference Rules

Context:
- A review found that quick-open chapter targets could choose a different duplicate chapter source than the visible chapter list and library summary.

Learning:
- Any endpoint that selects a single chapter from duplicate source candidates must apply the same source preference rules as the user-facing list/summary behavior.

Action:
- Updated chapter target selection to choose the boundary chapter number first, then select the preferred source candidate for that chapter number.
- Added tests for `latest` and `next-unread` duplicate-source selection.

## 2026-06-03 - Provider Error Payloads Must Stay Visible

Context:
- Investigating why MangaPlus title `100405` for Asura's Verdict did not appear or sync showed that the MangaPlus API returned an `Account Banned` error payload instead of title metadata or chapters.

Learning:
- Scrapers that convert upstream provider errors into empty results make blocked, banned, region-limited, or malformed provider states look like "no chapters found."

Action:
- MangaPlus now distinguishes upstream error payloads from true empty chapter lists, so update checks can persist/report the provider failure on the source.

## 2026-06-05 - Latest Chapter Links May Be Placeholders

Context:
- Blue Lock Manga listed chapter 349 on the index, but the chapter page only exposed a single placeholder-style image while chapter 348 had normal reader pages.

Learning:
- Dedicated manga sites can publish a chapter URL before real pages are available, so an index link alone is not enough evidence for a new readable chapter.

Action:
- Blue Lock chapter scraping now probes the newest listed chapter and skips it when the configured reader-page minimum is not met.

## 2026-06-05 - External Official Chapters Should Not Be Substituted

Context:
- Maison chapter 35 existed on MangaPlus, but Mangateo only had the MangaDex placeholder row and could route the user to MangaDex instead of the official MangaPlus chapter.

Learning:
- External-reader sources such as MangaPlus are already the correct reading destination, so reader fallback should not replace them with another provider's same-number chapter.

Action:
- Reader fallback now skips alternative probing for external-reader sources, and Maison has a MangaPlus source/chapter record for chapter 35.

## 2026-06-05 - Atsumaru Reader URLs Can Carry Newer Chapters Than Bulk Lists

Context:
- The One Punch-Man Atsumaru reader URL exposed `Mag Version 232`, while the bulk `allChapters` endpoint topped out at chapter 231 during implementation.

Learning:
- When a provider source URL is a direct reader URL, the linked chapter itself may be the freshest signal even if the provider's chapter list lags behind it.

Action:
- Atsumaru chapter scraping merges the linked reader chapter into the bulk chapter list before sorting and storing results.

## 2026-06-08 - Source Candidates Need Lane-Specific Scoring

Context:
- MangaPill looked strong for manga reader coverage but explicitly did not cover manhwa, while single-title sites were useful fallbacks without broad catalog value.

Learning:
- Provider quality should be scored separately for manga, manhwa/manhua/webtoon, and single-title fallback lanes. A source can be top priority in one lane and unsupported in another.

Action:
- Use the source quality scorecard and `npm run source:compare` before ranking or implementing a new provider.

## 2026-06-08 - Source Priority Must Match Across UI, SQL, and Updater Paths

Context:
- Single-title sources were documented as fallback sources, but Houseki no Kuni still showed only the Land of the Lustrous source because source filtering, summary SQL, and chapter ranking still encoded the older priority rule.

Learning:
- Source lane decisions must be applied consistently anywhere sources are filtered, ranked, summarized, or scraped. Otherwise a lower-priority fallback can still dominate one user-facing path.

Action:
- When changing provider priority, check `source-overrides`, chapter target ranking, library summary SQL, updater source selection, and client-side chapter scoring together.

## 2026-06-08 - Alias Tables Need Combined Provider Titles

Context:
- After the Rain and Koi wa Ameagari no You ni were tracked as separate manga, and MangaPill discovery missed the source because MangaPill returns the combined title `Koi wa Ameagari no You ni After the Rain`.

Learning:
- Alias groups need to include provider-combined titles, not just individual English/Japanese title variants, because strict source matching intentionally rejects near matches.

Action:
- Add combined provider titles to `manga-aliases` when a provider returns multiple title variants in one title string.

## 2026-06-10 - Single-Title Reader Sources Need Live CDN Patterns

Context:
- Witch Hat Atelier's dedicated source exposed chapter pages with public images on a third-party CDN path, but the generic single-manga scraper only accepted WordPress uploads or generic reader-looking paths.
- MangaPill discovery also missed Witch Hat because MangaPill returned the combined title `Tongari Boushi no Atelier Atelier of Witch Hat`.

Learning:
- Dedicated-source reader checks should include the current content CDN pattern, and alias groups need provider-combined titles for strict source discovery.

Action:
- When a dedicated source stops opening in the reader, compare the live chapter image URLs against both dedicated and generic single-site scraper allow rules, then add a focused parser test.

## 2026-06-17 - Reader Progress Must Use Loaded Page Evidence

Context:
- Infinite reader scrolling could append the next chapter before its lazy images had loaded, making the chapter section measure as if it were already near completion.

Learning:
- Scroll-based progress should not rely on section height alone. Lazy images and content visibility can make unread chapters appear completed before the user reaches their pages.

Action:
- Auto progress now requires the loaded final page image to be reached before marking a chapter read, and background auto-mark failures do not spam user-facing error toasts.

## 2026-06-17 - Image Proxy Headers Are Host-Specific

Context:
- MangaDex cover images failed through the image proxy while direct GET requests still returned image data.

Learning:
- A browser-like user agent can be rejected by MangaDex's upload CDN even when it is required by other image hosts, so the proxy must not reuse one provider's headers globally.

Action:
- Keep proxy header rules scoped per host and add route tests for provider-specific image headers when adding or changing image sources.

## 2026-06-17 - Source Discovery Needs URL-Slug Matching

Context:
- Choujin X existed on MangaPill at `/manga/5454/choujin-x`, but MangaPill search labeled it `Choujin X Overhuman X`, so exact title matching rejected the valid source.

Learning:
- Provider search results can append alternate localized titles. Exact title matching alone is too strict when the provider URL contains an exact canonical slug.

Action:
- Missing-source discovery now accepts exact title/alias matches or exact provider URL slug matches, and the updater uses shared discovery for all registered searchable chapter providers.

## 2026-06-17 - Source Order Must Drive Every Reader Entry Point

Context:
- A manga page could show a dedicated source first, but a reader fallback path still used hardcoded provider priority and unranked sources could appear in an order that did not match chapter target selection.

Learning:
- Source order is a user-facing contract. The manga detail source list, latest/next-unread targets, chapter target API, and reader fallback must all use the same ranking semantics.

Action:
- Use the shared source ranking helper for manga detail source ordering and reader fallback alternatives, and keep generic dedicated manga sources ranked ahead of MangaDex by default.

## 2026-06-20 - Serverless Queues Need Stale Lock Recovery

Context:
- Shared manga sync jobs run inside Vercel Functions using `after(...)` for immediate manual processing.
- A function can stop after claiming jobs as `RUNNING`, leaving shared jobs locked and user library rows stuck in `SYNCING`.

Learning:
- Any durable queue processed by best-effort serverless workers needs stale `RUNNING` job recovery before enqueueing or claiming more work.

Action:
- Requeue stale running sync jobs before enqueueing or processing queue work, and keep a regression test for stale lock recovery.

## 2026-07-02 - Content Restrictions Must Guard Resources, Not Cards

Context:
- Manga can be reached through Explore, library cards, detail URLs, chapter APIs, internal readers, progress endpoints, source links, and external-reader redirects.

Learning:
- UI filtering is not an authorization boundary. A content policy must be evaluated from persisted trusted metadata at every server-side resource entry point, and unknown metadata must fail closed for restricted accounts.

Action:
- Keep parental decisions in the shared policy evaluator, return stable server-side denial codes, and add the guard whenever a new manga or chapter access path is introduced.

## 2026-07-02 - Multi-Provider Safety Must Merge Conservatively

Context:
- Different providers can expose different ratings and genre/tag sets for the same manga, while some expose no classification at all.

Learning:
- Classification must query every linked source, union all tags, and choose the strictest rating. Missing provider metadata is not evidence that a title is safe, and transient provider failures must not erase known restrictions.

Action:
- Refresh the shared classification after source discovery and update cycles; infer ratings only from explicit adult-content labels and retain the last known classification when no provider returns usable metadata.

## 2026-07-06 - Bind Addresses Are Not Browser Redirect Origins

Context:
- A development server bound to `0.0.0.0` serves both `localhost` and `127.0.0.1`, but constructing a redirect from the server-normalized request URL produced an unusable `0.0.0.0` browser destination.

Learning:
- A network bind address is not necessarily a valid user-facing origin, especially in multi-origin local testing.

Action:
- Prefer relative redirects when a flow should remain on the request's current origin.

## 2026-07-06 - Use Explicit Cookie Names For Same-Browser Test Personas

Context:
- Hostname-based cookie isolation was not dependable enough for simultaneous parent/child testing in every browser surface, and cookies are not isolated by port.

Learning:
- Multi-persona local testing is more robust when each app instance reads a distinct session-cookie name rather than relying on browser context behavior.

Action:
- Run each persona on its own port and build directory, with a role-specific Auth.js session cookie.

## 2026-07-06 - Inline Head Scripts Can Be Mutated Before Hydration

Context:
- A browser extension added a `src` attribute and changed the contents of the inline theme initialization script before React hydrated the root layout.

Learning:
- Suppressing hydration warnings on the root element does not cover attribute or content mutations on a descendant script node.

Action:
- Mark intentional inline head scripts with `suppressHydrationWarning` when extensions may mutate them before hydration, while keeping the suppression scoped to that exact node.
