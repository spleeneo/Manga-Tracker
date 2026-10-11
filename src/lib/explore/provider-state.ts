import type { ExploreDisplayManga } from "./ui-results";

export const BROWSE_PROVIDERS = ["pill", "dex"] as const;
export type BrowseProvider = typeof BROWSE_PROVIDERS[number];
export type BrowseLoadMode = "initial" | "more" | "retry";
export interface ProviderPageState {
  results: ExploreDisplayManga[];
  nextOffset: number | null;
  failed: boolean;
}
export interface BrowseState {
  queryKey: string;
  providers: Record<BrowseProvider, ProviderPageState>;
}
export function emptyBrowseState(queryKey: string): BrowseState {
  return { queryKey, providers: { pill: { results: [], nextOffset: 0, failed: false }, dex: { results: [], nextOffset: 0, failed: false } } };
}
export function shouldLoadProvider(state: ProviderPageState, mode: BrowseLoadMode) {
  return mode === "retry" ? state.failed : state.nextOffset !== null;
}
export function appendProviderPage(state: ProviderPageState, results: ExploreDisplayManga[], nextOffset: number | null): ProviderPageState {
  return { results: [...state.results, ...results], nextOffset, failed: false };
}
