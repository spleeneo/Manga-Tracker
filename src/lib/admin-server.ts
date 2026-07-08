import { auth } from "../../auth";
import { isAdmin } from "@/lib/admin";

export async function getAdminActor() {
  const session = await auth();
  if (!session?.user?.id) return { user: null, status: 401 as const };
  if (!isAdmin(session.user)) return { user: null, status: 403 as const };
  return { user: session.user, status: 200 as const };
}
