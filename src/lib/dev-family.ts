import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

export const DEV_FAMILY = {
  parent: { email: "dev-parent@mangateo.local", name: "Dev Parent" },
  child: { email: "dev-child@mangateo.local", name: "Dev Child" },
} as const;

export type DevFamilyRole = keyof typeof DEV_FAMILY;

export function parseDevFamilyRole(value: unknown): DevFamilyRole | null {
  return value === "parent" || value === "child" ? value : null;
}

export function isDevFamilyLoginEnabled() {
  return process.env.NODE_ENV === "development";
}

export function devFamilyRoleForHost(host: string | null, configuredRole: unknown = process.env.DEV_FAMILY_ROLE): DevFamilyRole | null {
  const role = parseDevFamilyRole(configuredRole);
  if (role) return role;
  const normalizedHost = host?.toLowerCase();
  if (normalizedHost === "localhost:3000") return "parent";
  if (normalizedHost === "localhost:3001") return "child";
  return null;
}

export function devFamilySessionCookieName(role: DevFamilyRole | null = parseDevFamilyRole(process.env.DEV_FAMILY_ROLE)) {
  return role ? `authjs.${role}-session-token` : "authjs.session-token";
}

export function isDevFamilyEmail(email: string | null | undefined) {
  return email === DEV_FAMILY.parent.email || email === DEV_FAMILY.child.email;
}

export async function createDevFamilySession(role: DevFamilyRole) {
  if (!isDevFamilyLoginEnabled()) throw new Error("Development family login is disabled");

  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const sessionToken = randomUUID();

  await prisma.$transaction(async (tx) => {
    const parent = await tx.user.upsert({
      where: { email: DEV_FAMILY.parent.email },
      update: { name: DEV_FAMILY.parent.name },
      create: DEV_FAMILY.parent,
    });
    const child = await tx.user.upsert({
      where: { email: DEV_FAMILY.child.email },
      update: { name: DEV_FAMILY.child.name },
      create: DEV_FAMILY.child,
    });

    await tx.parentChildLink.upsert({
      where: { childEmail: DEV_FAMILY.child.email },
      update: { parentId: parent.id, childId: child.id, status: "ACTIVE" },
      create: { parentId: parent.id, childId: child.id, childEmail: DEV_FAMILY.child.email, status: "ACTIVE" },
    });
    await tx.childPolicy.upsert({
      where: { childId: child.id },
      update: {},
      create: { childId: child.id },
    });

    const userId = role === "parent" ? parent.id : child.id;
    await tx.session.deleteMany({ where: { userId, expires: { lt: new Date() } } });
    await tx.session.create({ data: { sessionToken, userId, expires } });
  });

  return { sessionToken, expires };
}
