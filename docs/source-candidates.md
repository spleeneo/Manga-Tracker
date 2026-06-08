# Source Candidates

This document tracks candidate providers before implementation.

## Selection criteria
- Free access to chapter metadata/pages without paid account requirements.
- Stable endpoint or HTML structure that can be parsed with low churn.
- Terms and robots policies reviewed before enabling by default.
- Supports enough metadata for title, chapter links, and cover images.
- Official/licensed sources are preferred over community mirrors when they can support the same tracking job.
- In-app reader support is only allowed when the provider exposes public readable images/API without bypassing access controls. Otherwise, add the source as tracking plus external-open only.

## Source quality scorecard

Evaluate broad and title-specific sources in separate lanes:

- **Manga**: Japanese manga catalog and reader quality.
- **Manhwa/manhua/webtoon**: Korean/Chinese/webtoon catalog and official/free public episode quality.
- **Single-title manga sites**: title-specific mirrors that may be excellent fallbacks but should not compete with broad catalogs.

Score each candidate using:

- Catalog size by lane, including whether the source explicitly excludes a lane.
- Freshness against representative ongoing titles: latest chapter number, release date, and update delay.
- Completeness: missing integer chapter gaps, duplicate chapter numbers, decimals/specials, and skipped latest chapters.
- Reader quality: page count, image reachability, referer/header requirements, blocked/paywalled/error states.
- Search quality: exact title match rate, alternate-title handling, and false positives.
- Operational risk: Cloudflare, rate limits, VPN/region/account requirements, domain churn, and selector/API stability.

Run `npm run source:compare` to sample current providers plus MangaPill and print ranked tables for manga reader, manga tracking, manhwa/manhua/webtoon, and single-title fallback lanes.

## Current recommendation

### MangaPill implemented for manga reader coverage

- Bucket: community/free, broad manga catalog.
- Lane: manga. Do not count it as a manhwa/manhua/webtoon source because MangaPill currently says it removed manhwa from the site.
- Access model: public manga pages and public reader image URLs; the image CDN requires a chapter/source `Referer`.
- Integration: search, metadata, chapter tracking, decimal chapter handling, and in-app reader support through the image proxy's MangaPill referer handling.
- Existing-library behavior: update checks can attach MangaPill to already tracked manga when MangaPill search returns a strict title or configured-alias match.
- Why prioritized: Mangateo's in-app reader is a top product feature, and live probes on 2026-06-08 found MangaPill ahead of current broad reader sources for representative manga chapter depth and readable page availability.
- Risk: community mirror status, Cloudflare, selector churn, CDN hotlink rules, and lower product/legal preference than official sources.

### Follow-up order

1. Periodically rerun the source comparison harness.
   - Confirm MangaPill continues to win the manga reader lane for enough ongoing/completed titles.
   - Revalidate MangaDex, NeloManga, Manganato, MangaPlus, Webtoon, and single-title sources using exact-match scoring.
2. Improve `MangaPlus`.
   - It is already registered and official, but currently lacks reader support and does not model first/newest/free availability explicitly.
   - Add a readability/free-window probe before using it as a top ranked chapter candidate.
3. Add `Azuki`.
   - Official licensed manga with a cleaner catalog shape than scraper-heavy sites.
   - Start with search/metadata/chapter tracking and external-open.
4. Add `K MANGA`.
   - Official Kodansha source with strong catalog value.
   - Treat as external/tracking unless a public web flow is verified; availability has US/free-limit constraints.
5. Add `Manga UP!`.
   - Official Square Enix source.
   - Treat as external/tracking; app/item/subscription mechanics make in-app reading unlikely at first.
6. Improve `Webtoon`.
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

- **MangaPill** (community/free)
  - Lane: manga.
  - Access: free public listings and reader pages; reader images require a MangaPill `Referer`.
  - Catalog signal: about 10k manga IDs observed from `/mangas/new` on 2026-06-08.
  - Freshness signal: `/chapters` exposes 120 recent chapters and showed same-day updates on 2026-06-08, including Dandadan chapter 236.
  - Reader signal: live probes found readable images for One Piece, Dandadan, Blue Lock, and Witch Hat Atelier.
  - Harness signal: `npm run source:compare` on 2026-06-08 ranked MangaPill first for the manga reader lane and manga tracking lane across the sample set.
  - Risk: community mirror status, Cloudflare, no manhwa lane coverage, and potential CDN/selector churn.
  - Integration status: implemented with search, metadata, chapter tracking, decimal chapter handling, and in-app reader support.

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
