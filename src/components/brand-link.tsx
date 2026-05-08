import Image from "next/image";
import Link from "next/link";

export function BrandLink() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2 rounded-md pr-1 text-2xl font-bold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Mangateo home"
    >
      <span className="flex h-11 w-14 items-center justify-center rounded-lg border border-border bg-white p-1 shadow-sm dark:bg-muted">
        <Image
          src="/mangateo-logo.png"
          alt=""
          width={48}
          height={34}
          className="h-8 w-12 object-contain dark:invert dark:opacity-90"
          priority
        />
      </span>
      <span className="whitespace-nowrap">Mangateo</span>
    </Link>
  );
}
