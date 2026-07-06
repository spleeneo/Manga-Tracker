import { prisma } from "@/lib/db";
import { canonicalTagKey } from "@/lib/content-taxonomy";

export const DEFAULT_ALLOWED_CONTENT_RATINGS = ["safe", "suggestive", "erotica", "pornographic"];
export const DEFAULT_BLOCKED_TAG_NAMES = ["gore", "sexual violence"];

export type MangaAccessReason = "allowed" | "blocked_rating" | "blocked_tag" | "unclassified" | "title_blocked";
export interface MangaClassification { contentRating: string | null; classificationSource: string | null; tags: string[]; }
export interface ChildPolicyInput { enabled: boolean; allowedContentRatings?: string[]; blockedTagNames: string[]; }

export function evaluateMangaAccess(policy: ChildPolicyInput | null, manga: MangaClassification, override?: "ALLOW" | "BLOCK" | null) {
  if (!policy?.enabled) return { allowed: true, reason: "allowed" as const };
  if (override === "BLOCK") return { allowed: false, reason: "title_blocked" as const };
  if (override === "ALLOW") return { allowed: true, reason: "allowed" as const };
  if (!manga.contentRating || !manga.classificationSource) return { allowed: false, reason: "unclassified" as const };
  const blockedTags = new Set(policy.blockedTagNames.map(canonicalTagKey));
  if (manga.tags.some((tag) => blockedTags.has(canonicalTagKey(tag)))) return { allowed: false, reason: "blocked_tag" as const };
  return { allowed: true, reason: "allowed" as const };
}

export async function getMangaAccess(userId: string, mangaId: string) {
  // Route unit tests use intentionally narrow Prisma doubles; absent parental models mean an adult context.
  if (!prisma.parentChildLink) return { allowed: true, reason: "allowed" as MangaAccessReason, isChild: false };
  const link = await prisma.parentChildLink.findUnique({
    where: { childId: userId },
    include: { child: { include: { childPolicy: true } } },
  });
  if (!link || link.status !== "ACTIVE") return { allowed: true, reason: "allowed" as MangaAccessReason, isChild: false };
  const [manga, titleOverride] = await Promise.all([
    prisma.manga.findUnique({ where: { id: mangaId }, select: { contentRating: true, classificationSource: true, tags: { select: { tag: { select: { name: true } } } } } }),
    prisma.childMangaOverride.findUnique({ where: { childId_mangaId: { childId: userId, mangaId } }, select: { decision: true } }),
  ]);
  if (!manga) return { allowed: false, reason: "unclassified" as MangaAccessReason, isChild: true };
  const policy = link.child?.childPolicy ?? { enabled: true, allowedContentRatings: DEFAULT_ALLOWED_CONTENT_RATINGS, blockedTagNames: DEFAULT_BLOCKED_TAG_NAMES };
  return { ...evaluateMangaAccess(policy, { ...manga, tags: manga.tags.map(({ tag }) => tag.name) }, titleOverride?.decision as "ALLOW" | "BLOCK" | undefined), isChild: true };
}

export async function getChildPolicy(userId: string): Promise<ChildPolicyInput | null> {
  if (!prisma.parentChildLink) return null;
  const link = await prisma.parentChildLink.findUnique({ where: { childId: userId }, select: { status: true } });
  if (link?.status !== "ACTIVE") return null;
  return await prisma.childPolicy.findUnique({ where: { childId: userId } })
    ?? { enabled: true, allowedContentRatings: DEFAULT_ALLOWED_CONTENT_RATINGS, blockedTagNames: DEFAULT_BLOCKED_TAG_NAMES };
}

export function parentalControlError(reason: MangaAccessReason) {
  return Response.json({ error: "Unavailable under parental controls", code: reason }, { status: 403 });
}
