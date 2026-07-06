import { auth, signIn, signOut } from "../../auth";
import { LogOut } from "lucide-react";

export async function AuthButton() {
  const session = await auth();
  const isGoogleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const showDevFamilyLogin = process.env.NODE_ENV === "development";

  if (!session?.user) {
    if (showDevFamilyLogin) {
      return (
        <div className="flex items-center gap-2">
          <form action="/api/auth/dev-login" method="post">
            <button className="ui-button ui-button-secondary" name="role" value="parent">
              Test as parent
            </button>
          </form>
          <form action="/api/auth/dev-login" method="post">
            <button className="ui-button ui-button-primary" name="role" value="child">
              Test as child
            </button>
          </form>
        </div>
      );
    }

    if (!isGoogleConfigured) {
      return (
        <span className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground">
          Google auth setup needed
        </span>
      );
    }

    return (
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button className="ui-button ui-button-primary">
          Sign in with Google
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 xl:gap-3">
      <div className="hidden text-right xl:block">
        <p className="text-sm font-medium leading-none">{session.user.name ?? "Signed in"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{session.user.email}</p>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button className="ui-button ui-button-secondary h-10 w-10 px-0 xl:w-auto xl:px-3.5" aria-label="Sign out" title="Sign out">
          <LogOut className="h-4 w-4 xl:hidden" />
          <span className="hidden xl:inline">Sign out</span>
        </button>
      </form>
    </div>
  );
}
