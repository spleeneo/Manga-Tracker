import "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    user?: {
      id: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
