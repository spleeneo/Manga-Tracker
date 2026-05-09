import Image from "next/image";
import Link from "next/link";

export function BrandLink() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2 rounded-md pr-1 text-2xl font-bold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Mangateo home"
    >
      <span className="flex h-10 w-12 items-center justify-center rounded-md border border-border/70 bg-white p-0.5 shadow-sm dark:border-transparent dark:bg-transparent dark:shadow-none">
        <Image
          src="/mangateo-logo.png"
          alt=""
          width={48}
          height={34}
          className="h-8 w-11 object-contain dark:invert dark:opacity-90"
          priority
        />
      </span>
      <span className="whitespace-nowrap">Mangateo</span>
    </Link>
  );
}
