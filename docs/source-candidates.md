# Source Candidates

This document tracks candidate providers before implementation.

## Selection criteria
- Free access to chapter metadata/pages without paid account requirements.
- Stable endpoint or HTML structure that can be parsed with low churn.
- Terms and robots policies reviewed before enabling by default.
- Supports enough metadata for title, chapter links, and cover images.
- Official/licensed sources are preferred over community mirrors when they can support the same tracking job.
- In-app reader support is only allowed when the provider exposes public readable images/API without bypassing access controls. Otherwise, add the source as tracking plus external-open only.

## Current recommendation

### Next source: Comikey

- Bucket: official/licensed, high-value catalog.
- Access model: free app/web reading for much of the catalog through ads or free keys; newest chapters may require paid keys.
- Expected integration: tracking, metadata, chapter links, external reading first.
- Reader stance: only enable Mangateo reader if public pages expose stable readable image URLs without ad/key/session bypassing.
- Why first: broad manga/manhua/manhwa/webtoon coverage, official releases, and likely better user value than adding another community mirror.

### Follow-up order

1. Improve `MangaPlus`.
   - It is already registered and official, but currently lacks reader support and does not model first/newest/free availability explicitly.
   - Add a readability/free-window probe before using it as a top ranked chapter candidate.
2. Add `Azuki`.
   - Official licensed manga with a cleaner catalog shape than scraper-heavy sites.
   - Start with search/metadata/chapter tracking and external-open.
3. Add `K MANGA`.
   - Official Kodansha source with strong catalog value.
   - Treat as external/tracking unless a public web flow is verified; availability has US/free-limit constraints.
4. Add `Manga UP!`.
   - Official Square Enix source.
   - Treat as external/tracking; app/item/subscription mechanics make in-app reading unlikely at first.
5. Improve `Webtoon`.
   - Already implemented for free public web episodes.
   - Strengthen lock/ad/Fast Pass/Daily Pass detection before ranking it as best available.

## Official provider backlog

- **Comikey**
  - Access: official/licensed; free access for much of the catalog through ads/free keys, with paid-key limits for latest chapters.
  - Risk: ad/key state, changing frontend/API, paid latest chapters.
  - Initial scope: search, metadata, chapter tracking, external reading.
  - Integration status: implemented for tracking/external reading.

- **Azuki**
  - Access: official/licensed; some free chapters, broader access depends on subscription/app state.
  - Risk: limited free depth and account/subscription boundaries.
  - Initial scope: search, metadata, chapter tracking, external reading.
  - Integration status: high-priority candidate after MangaPlus improvements.

- **K MANGA**
  - Access: official Kodansha app; US-focused availability and limited free reading.
  - Risk: region limits, app-centric behavior, point/ticket access.
  - Initial scope: external/tracking only.
  - Integration status: candidate after Azuki.

- **Manga UP!**
  - Access: official Square Enix app/web service with daily/item-based free mechanics.
  - Risk: app/item/subscription access, catalog changes, likely limited public reader surface.
  - Initial scope: external/tracking only.
  - Integration status: candidate after K MANGA.

## Existing provider improvement backlog

- **MangaPlus** (official/free-window)
  - Current status: implemented.
  - Current behavior: tracks public first/latest chapter windows and opens chapters externally.
  - Needed work: reader capability review and richer availability metadata if the upstream API exposes a stable field.
  - Priority: very high.

- **Webtoon** (official/free public episodes)
  - Current status: implemented.
  - Current behavior: filters common locked, Fast Pass, Daily Pass, ad unlock, coin, and app-only episode rows; continues pagination past pages that contain only gated episodes.
  - Needed work: live periodic checks against representative ongoing and completed series.
  - Priority: high.

## Community provider backlog

- **Webtoon** (official/free)
  - Access: free web episodes.
  - Risk: moderate HTML structure churn.
  - Integration status: implemented in first expansion batch.

- **Manganato** (community/free)
  - Access: free public web pages.
  - Risk: moderate-high selector churn and anti-bot changes.
  - Integration status: implemented in first expansion batch.

- **Atsumaru** (community/free)
  - Access: free public app/API pages.
  - Risk: app API shape can change, and search currently returns MangaBaka ids rather than the `atsu.moe` manga ids required for tracking.
  - Integration status: implemented for manual `atsu.moe` source URLs with in-app reader support.

- **ComicK** (community/free)
  - Access: free listings and reader pages.
  - Risk: API/URL pattern changes and stricter rate limiting.
  - Integration status: lower priority than official sources unless specific titles need it.

- **Bato** (community/free)
  - Access: free reading pages.
  - Risk: anti-bot and inconsistent chapter markup.
  - Integration status: lower priority than official sources unless specific titles need it.

## Technical index

- Tachiyomi/Mihon extension lists are useful as a map of source candidates, URL patterns, and edge cases.
- Do not treat extension availability as approval to add a source. Each provider still needs a legal/stability review and a Mangateo-specific access model.

## Onboarding checklist
- Implement scraper based on `src/lib/scrapers/provider-template.ts`.
- Register scraper in `src/lib/scrapers/registry.ts`.
- Add source-name inference in `src/app/api/manga/route.ts`.
- Add contract tests under `tests/scrapers`.
- Update user-facing supported provider text in UI and README.
- Decide whether the provider should be added to `src/lib/external-reader-sources.ts`.
- Revisit source ranking in `src/components/chapter-list.tsx` and `src/lib/library-summary.ts` only after readability/free-window behavior is known.
