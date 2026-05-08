# Product Notes

These are product and UX decisions worth keeping visible while Mangateo evolves.

## Current Product Shape

Mangateo is a personal manga library:

- Track manga by source search or manual source URL.
- Reuse shared manga/source/chapter data in the background.
- Keep each user's library and read progress private.
- Display a merged "Best Available" chapter list by default, with provider-specific tabs available.

## UX Principles

- Prefer a quiet, readable app UI over a decorative landing page.
- Buttons, selectors, dialogs, and cards should share one visual language.
- Every interactive element should have visible hover, active, selected, disabled, and focus states.
- Dialogs should use the same solid surface treatment.
- Avoid nested interactive elements; clickable areas should be keyboard-friendly.

## Near-Term Improvements

- Add a continue-reading area on the home page.
- Add library summary stats: unread count, updated today, caught-up titles.
- Replace `alert()` with toast feedback for success and failure states.
- Add loading and empty states for update checks and metadata refreshes.
- Let users hide/archive/completed titles.
- Add mobile-specific polishing for the detail page header controls.

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
- Better search result grouping for alternate titles and translations.
- Import/export library data.
- Background update queue.
