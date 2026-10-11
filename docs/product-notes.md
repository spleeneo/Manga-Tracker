# Product Notes

These are product and UX decisions worth keeping visible while Mangateo evolves.

## Current Product Shape

Mangateo is a personal manga library:

- Track manga through provider search results.
- Reuse and enrich shared manga/source/chapter data in the background.
- Keep each user's library and read progress private.
- Display a merged "Best Available" chapter list by default, with provider-specific tabs available.

## UX Principles

- Prefer a quiet, readable app UI over a decorative landing page.
- Buttons, selectors, dialogs, and cards should share one visual language.
- Every interactive element should have visible hover, active, selected, disabled, and focus states.
- Dialogs should use the same solid surface treatment.
- Avoid nested interactive elements; clickable areas should be keyboard-friendly.
- Treat desktop and mobile as paired surfaces: every UI change should update and verify both responsive versions.

## Implemented Core Workflows

- Continue reading, summary counts, optimistic reading progress, and toast feedback are available.
- Library search, unread/caught-up filtering, and update/recent-reading/title sorting survive synchronization refreshes. Failed refreshes retain loaded titles with retry.
- Discovery has provider-independent pagination, conservative deduplication, URL filters, hide-tracked controls, and an accessible preview with tracking/library actions and explicit source links.
- Search retains successful providers when another fails, distinguishes failures from empty matches, and supports retry. MangaDex uses relevance ordering and 24 results.
- The reader offers explicit external-source navigation and retryable next-chapter requests. Automatic source popups are removed.
- Shared background updates use a durable Postgres queue with bounded processing and backlog metrics.

## Near-Term Follow-Up

- Collect concrete unresolved duplicate examples before extending identity rules. Matching titles alone are insufficient evidence; separate works stay separate.
- Monitor production search latency and queue age before choosing further optimizations. Keep hosting near free.
- Complete longer real-device reading and production network-failure checks; see [performance-review.md](performance-review.md).

## Readability Detection

The long-term goal for "Best Available" is to pick the most readable and current chapter across sources. That likely needs a chapter availability model:

- `readable`
- `empty`
- `paywalled`
- `regionBlocked`
- `unknown`

Useful signals could include page count, official API flags, reader error states, HTTP status, known paywall text, and provider-specific metadata.

## Backlog

- Preferred source per manga.
- Source health badges.
- Manual rescan of one source.
- Chapter alternative drawer for merged duplicate chapter numbers.
- Page-level bookmarks, import/export, combined genre filters, and recommendations need separate specifications after the core workflows are verified.
