# Providers

Mangateo supports multiple manga sources through scraper classes in `src/lib/scrapers`.

## Registered Providers

- `MangaDex`
- `NeloManga`
- `MangaPlus`
- `Comikey`
- `VIZ`
- `Urek Mazino`
- `Bleach Live`
- `Atsumaru`
- `Webtoon`
- `Manganato`
- `MangaPill`

The registry in `src/lib/scrapers/registry.ts` decides which scraper handles a URL, fans out search across all providers, and aggregates search results by normalized title.

## Provider Capabilities

Each provider is expected to expose:

- `search(query)`: returns candidate manga records.
- `fetchMetadata(url)`: returns title, cover, status, author, and description when available.
- `fetchChapters(url)`: returns chapter number, title, URL, release date, and optional provider chapter id.

Provider support can degrade independently. Search may fail for one provider while others still return results.

## Current Best-Available Logic

The UI and library summary currently group chapters by chapter number and choose one candidate using a source ranking plus release date:

1. Title-specific manga sources when configured for that title
2. MangaPill
3. NeloManga
4. Urek Mazino / Bleach Live / Atsumaru
5. MangaPlus
6. MangaDex
7. Webtoon
8. Manganato
9. Unknown providers

This is a placeholder for readability-aware selection. It does not currently verify whether the linked chapter has readable pages, is region-blocked, or is paywalled.

The reader fallback route uses a separate in-app reader priority for alternatives:

1. MangaPill
2. MangaDex
3. Urek Mazino
4. Bleach Live
5. Manganato
6. NeloManga
7. Other providers

Providers can therefore be useful even when they are external-only. Official app-centric sources such as MangaPlus, Comikey, Azuki, K MANGA, and Manga UP! should start as tracking/external-reader providers unless their public web reader exposes stable readable images/API without bypassing access controls.

Atsumaru supports manual `atsu.moe` manga/reader URLs and can populate the Mangateo reader from its public read endpoint. It does not currently participate in search because the public MangaBaka search result does not include the `atsu.moe` app manga id needed for source URLs.

## Known Provider Limitations

- Provider HTML/API formats can change without warning.
- Some chapter links can exist but contain no readable pages.
- Some official providers may expose only recent chapters or require app/browser-specific behavior.
- Search aggregation by title can merge imperfectly when providers use alternate names or translations.
- Current duplicate detection is per source, not cross-source semantic matching.

## Future Provider Work

- Add a `readabilityStatus` or similar field for chapter candidates.
- Probe chapter pages for page count, paywall markers, region locks, and empty reader states.
- Track provider failures on `Source.lastError`, `failureCount`, `lastCheckedAt`, and `lastSuccessAt`.
- Expose source health in the UI.
- Let users set a preferred source per manga using `UserManga.preferredSourceId`.
