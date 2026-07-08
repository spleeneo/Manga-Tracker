export function isAdmin(user: { role?: string | null } | null | undefined) {
  return user?.role === "ADMIN";
}
