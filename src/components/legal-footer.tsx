import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="page-wrap pb-6 pt-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border pt-4 sm:justify-between">
        <span>&copy; {new Date().getFullYear()} Mangateo</span>
        <Link
          href="/privacy"
          className="font-semibold underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
