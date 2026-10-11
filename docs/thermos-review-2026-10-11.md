# Thermos review — 2026-10-11

Reviewed improvement release `b26234c` against parent `e2b3c6e`, using the upstream Cursor Thermos correctness and code-quality review skills in parallel. The skills were installed into the local Codex skills directory; this did not install the Cursor plugin runtime. This is a review, not a repair batch.

## Verdict

Not a clean pass. Four P2 defects warrant focused fixes and regression coverage. The previous verification (72 files, 316 tests, lint and production build, update smoke, desktop/mobile acceptance) passed but did not cover these cases. No P0/P1 finding was established. There is no PR discussion to reconcile because this release was delivered directly to main.

## Findings

1. **P2: Preserve provider identity query parameters.** `src/lib/search-library.ts:7` drops every query parameter when normalizing source URLs. Webtoon identifies works using `title_no` (`src/lib/scrapers/webtoon.ts:84`). Two same-path URLs with different title numbers become identical, causing false tracked badges/library links and bypassing conservative search aggregation checks. A deterministic helper reproduction using title numbers 101 and 202 returned `sameIdentity: true` and incorrectly marked the second work tracked. Preserve meaningful provider identity parameters and test both aggregation and library decoration.

2. **P2: Approve the established VIZ cover CDN.** `src/lib/image-proxy-policy.ts:4` omits the CDN used by the existing VIZ scraper. A live `VizScraper.fetchMetadata("https://www.viz.com/one-piece")` returned a cover on `dw9to29mmj727.cloudfront.net`; `allowedImageUrl` rejected it. These covers receive proxy HTTP 400. Add the exact reviewed host, retaining the restricted destination policy, and test the actual provider metadata/proxy contract.

3. **P2: Prevent pending actions from rolling back newer library data.** `src/components/library-dashboard.tsx:46–48` installs refreshed props into the stable dashboard. Pending progress/delete/sync handlers retain whole-library snapshots and restore them on failure at lines 126, 148 and 187. A refresh arriving before rejection can therefore be overwritten by the old snapshot, hiding newly added titles or refreshed progress/sync states until another fetch. This affects the displayed state, not persisted backend data. The former keyed remount discarded these old handlers. Use a server baseline with pending overlays, or version-aware rollback limited to the affected title. Test refresh-between-request-and-rejection.

4. **P2: Retry failed Discovery pages without resetting successful pages.** `src/components/explore-page.tsx:205–213` merges results but discards provider-page ownership. The Retry sources control at line 420 invokes `loadExplore(false, true)`, reloading both providers from offset zero and replacing all loaded pages after a pagination failure. Retain query-keyed per-provider results, cursor and request state, then derive the displayed merge. Test a successful first page, partial second-page failure, and retry while preserving already loaded results.

## Maintainability follow-up

The identity policies in `src/lib/explore/ui-results.ts:190–196` and `src/lib/scrapers/registry.ts:112–121` disagree about reordered author names and alternate-title evidence. Extract a pure browser-safe work-identity policy with shared cases; keep result ordering and metadata preference separate. This supports the first and fourth fixes without requiring an architecture rewrite.

## Evidence and limits

- Reviewed the release diff and relevant consumers; independently reproduced Webtoon identity/badge collision and VIZ cover rejection with `npx tsx` against current helpers and live VIZ metadata.
- Library rollback and pagination retry findings were verified by tracing changed state lifecycles; their failure sequences were not replayed in a browser during this audit.
- All-general-provider outage classification remains a lower-confidence semantic observation: static providers legitimately resolve empty arrays, so `allFailed` can remain false. Failures are still disclosed and retryable; this is not counted as a confirmed hidden-error defect.
- Unknown dynamically discovered image destinations remain intentionally restricted pending review; no speculative DNS/security finding is included.
- No application code was changed or findings fixed by this review. Each fix should use focused failing regressions, relevant browser checks, `npm run verify`, and update smoke when provider behavior changes.

## Resolution — repair and review loop

The user requested fixes followed by repeated Thermos review until no actionable complaints remained. The original findings above describe the audited release before repair.

- Provider identity now preserves Webtoon title_no across paths and ignores unrelated tracking parameters. Search and Discovery use one browser-safe work identity policy for author order, aliases and alternate titles, with conservative same-provider separation. Removed substring-only author matching to preserve distinct names such as Ann and Joann.
- The exact VIZ CDN host is approved. A live proxy check additionally revealed that its JPEG response omits Content-Type; the bounded body reader now recognizes headerless JPEG signatures and rejects headerless HTML and unsupported explicit MIME types. Live local proxy verification returned HTTP 200 image/jpeg.
- Library rollbacks affect only their own unchanged row and require the same server baseline. The first repair review found a related successful-delete/refresh race; a failing regression reproduced it, and successful deletion now removes only that title and requests a fresh library snapshot.
- Discovery retains query-keyed results, cursor and failure status per provider. Retry requests only failed providers at their retained cursor; successful pages and tracked badges survive.
- Thermos correctness and maintainability reviewers rechecked the full improvement release plus repairs. Both final iterations reported no remaining actionable high-confidence findings, including the successful-delete and headerless JPEG follow-ups. This is a scoped review verdict, not proof that the entire application is bug-free.
- Browser checks: authenticated local desktop Discovery grew from 48 to 96 cards; preview closure retained loaded pages and restored focus. Exact reported search placed In the name of God first with its tracked badge. Mobile 390x844 preview displayed synopsis, genres and Open in library, without horizontal overflow; Escape restored focus and library title filtering worked. No test memberships or reading progress were changed in this browser pass.
- Request/failure interleavings are covered by automated UI regressions; browser fault injection and deployed production revalidation were not performed in this repair batch. See the work log for final verification and delivery.
