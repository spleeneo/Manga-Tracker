import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { devFamilySessionCookieName, parseDevFamilyRole } from "@/lib/dev-family";

const devFamilyRole = parseDevFamilyRole(process.env.DEV_FAMILY_ROLE);

function getAllowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function activateChildInvite(user: { id?: string; email?: string | null }) {
  if (!user.id || !user.email) return;
  const childEmail = user.email.trim().toLowerCase();
  const invite = await prisma.parentChildLink.findUnique({ where: { childEmail } });
  if (!invite || (invite.childId && invite.childId !== user.id)) return;
  await prisma.$transaction([
    prisma.parentChildLink.update({ where: { id: invite.id }, data: { childId: user.id, status: "ACTIVE" } }),
    prisma.childPolicy.upsert({ where: { childId: user.id }, update: {}, create: { childId: user.id } }),
  ]);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...(devFamilyRole ? {
    cookies: {
      sessionToken: {
        name: devFamilySessionCookieName(devFamilyRole),
        options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
      },
    },
  } : {}),
  providers: [
    Google({
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowedEmails = getAllowedEmails();
      const allowed = allowedEmails.length === 0 || Boolean(user.email && allowedEmails.includes(user.email.toLowerCase()));
      if (allowed) await activateChildInvite(user);
      return allowed;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) { await activateChildInvite(user); },
  },
});
