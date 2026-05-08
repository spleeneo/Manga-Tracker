import { auth, signIn, signOut } from "../../auth";

export async function AuthButton() {
  const session = await auth();
  const isGoogleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  if (!session?.user) {
    if (!isGoogleConfigured) {
      return (
        <span className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
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
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          Sign in with Google
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-none">{session.user.name ?? "Signed in"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{session.user.email}</p>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
          Sign out
        </button>
      </form>
    </div>
  );
}
