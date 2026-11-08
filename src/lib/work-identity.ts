import { getMangaAliasGroup } from "@/lib/manga-aliases";
import { getMangaSourceOverride, isAllowedOverrideSource } from "@/lib/source-overrides";
import { sourceIdentity } from "@/lib/search-library";

export function normalizeSearchTitle(title: string) {
    return title
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/\bmanga\b/g, " ")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function getCanonicalSearchTitle(title: string) {
    const normalized = normalizeSearchTitle(title);
    return getMangaAliasGroup(normalized)?.slug ?? normalized;
}

function getAuthorParts(value?: string) {
    const parts = (value ?? "")
        .split(/\s+(?:and)\s+|[|/;,]/)
        .map(normalizeSearchTitle)
        .filter((part) => part.length >= 3);

    return parts;
}

function getSortedTokens(value: string) {
    return value.split(/\s+/).filter(Boolean).sort().join(" ");
}

function authorsMatch(left?: string, right?: string) {
    const leftParts = getAuthorParts(left);
    const rightParts = getAuthorParts(right);

    if (leftParts.length === 0 || rightParts.length === 0) return null;

    return leftParts.some((leftPart) => rightParts.some((rightPart) => (
        leftPart === rightPart
        || getSortedTokens(leftPart) === getSortedTokens(rightPart)
    )));
}

function sourceIsAllowedByOverride(title: string, source: { name: string; url: string }) {
    const override = getMangaSourceOverride({ title });
    return Boolean(override && isAllowedOverrideSource({
        sourceName: source.name,
        sourceUrl: source.url,
    }, override));
}

function sourceSharesKnownOverrideIdentity(title: string, source: { name: string; url: string }) {
    const normalizedTitle = normalizeSearchTitle(title);
    return normalizedTitle === "noise" && source.url === "https://www.nelomanga.net/manga/noise";
}

export interface WorkIdentity { title: string; alternateTitles?: string[]; author?: string; sources: Array<{ name: string; url: string }> }

export function sameWork(existing: WorkIdentity, result: WorkIdentity) {
    if (existing.sources.some(a => result.sources.some(b => sourceIdentity(a.url) === sourceIdentity(b.url)))) return true;
    if (existing.sources.some(a => result.sources.some(b => a.name === b.name))) return false;
    const left = [existing.title, ...(existing.alternateTitles ?? [])].map(getCanonicalSearchTitle).filter(Boolean);
    const right = [result.title, ...(result.alternateTitles ?? [])].map(getCanonicalSearchTitle).filter(Boolean);
    const overlap = left.filter(title => right.includes(title));
    const authorMatch = authorsMatch(existing.author, result.author);
    if (!overlap.length || authorMatch === false) return false;
    return authorMatch === true || new Set(overlap).size >= 2
        || overlap.some(title => Boolean(getMangaAliasGroup(title)))
        || result.sources.some(source => (sourceIsAllowedByOverride(existing.title, source) || sourceSharesKnownOverrideIdentity(existing.title, source)) && existing.sources.some(candidate => sourceIsAllowedByOverride(existing.title, candidate)));
}
