import Image from "next/image";
import Link from "next/link";

export function BrandLink() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2 rounded-md pr-1 text-2xl font-bold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Mangateo home"
    >
      <span className="relative flex h-10 w-12 items-center justify-center rounded-md p-0.5">
        <Image
          src="/mangateo-logo-light.png"
          alt=""
          width={48}
          height={34}
          className="h-8 w-11 object-contain dark:hidden"
          priority
          unoptimized
        />
        <Image
          src="/mangateo-logo-dark.png"
          alt=""
          width={48}
          height={34}
          className="hidden h-8 w-11 object-contain dark:block"
          priority
          unoptimized
        />
      </span>
      <span className="hidden whitespace-nowrap sm:inline">Mangateo</span>
    </Link>
  );
}
