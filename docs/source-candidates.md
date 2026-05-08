# Source Candidates (Free / Non-Paywalled)

This document tracks candidate providers before implementation.

## Selection criteria
- Free access to chapter metadata/pages without paid account requirements.
- Stable endpoint or HTML structure that can be parsed with low churn.
- Terms and robots policies reviewed before enabling by default.
- Supports enough metadata for title, chapter links, and cover images.

## Candidate backlog

- **Webtoon** (official/free)
  - Access: free web episodes.
  - Risk: moderate HTML structure churn.
  - Integration status: implemented in first expansion batch.

- **Manganato** (community/free)
  - Access: free public web pages.
  - Risk: moderate-high selector churn and anti-bot changes.
  - Integration status: implemented in first expansion batch.

- **ComicK** (community/free)
  - Access: free listings and reader pages.
  - Risk: API/URL pattern changes and stricter rate limiting.
  - Integration status: candidate for next batch.

- **Bato** (community/free)
  - Access: free reading pages.
  - Risk: anti-bot and inconsistent chapter markup.
  - Integration status: candidate for next batch.

## Onboarding checklist
- Implement scraper based on `src/lib/scrapers/provider-template.ts`.
- Register scraper in `src/lib/scrapers/registry.ts`.
- Add source-name inference in `src/app/api/manga/route.ts`.
- Add contract tests under `tests/scrapers`.
- Update user-facing supported provider text in UI and README.
