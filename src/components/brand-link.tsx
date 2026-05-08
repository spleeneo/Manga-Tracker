import Link from "next/link";

export function BrandLink() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center gap-2 rounded-md pr-1 text-2xl font-bold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Mangateo home"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
        <svg
          aria-hidden="true"
          className="h-8 w-8"
          viewBox="0 0 64 64"
          role="img"
        >
          <rect width="64" height="64" rx="16" fill="#0f172a" />
          <path d="M32 24c5.8 0 10.5 4.6 10.5 10.2v4.1C42.5 44 38.3 48 32 48s-10.5-4-10.5-9.7v-4.1C21.5 28.6 26.2 24 32 24z" fill="#f3c6a6" />
          <path d="M11 20c8.3-.5 15 1.7 21 6.4v25.8c-5.8-4.9-12.6-7.2-21-6.8V20z" fill="#fff7ed" />
          <path d="M53 20c-8.3-.5-15 1.7-21 6.4v25.8c5.8-4.9 12.6-7.2 21-6.8V20z" fill="#f8fafc" />
          <path d="M32 26.4c-6-4.7-12.7-6.9-21-6.4v25.4c8.4-.4 15.2 1.9 21 6.8m0-25.8c6-4.7 12.7-6.9 21-6.4v25.4c-8.4-.4-15.2 1.9-21 6.8" fill="none" stroke="#14b8a6" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M32 26.4v25.8" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M17 17c0-3 2.5-5.5 5.5-5.5 2.2 0 4.1 1.3 5 3.2 1-2.8 3.7-4.7 6.8-4.4 2.7.3 4.9 2.2 5.6 4.7 1.2-1.7 3.2-2.8 5.4-2.5 3 .4 5.2 3.1 4.8 6.1-.3 2.5-2.2 4.5-4.7 4.9-3.6.6-7.8 1.7-13.4 5.1-5.6-3.4-9.8-4.5-13.4-5.1-2.5-.4-4.4-2.4-4.7-4.9-.1-.5-.1-1.1.1-1.6z" fill="#2b1b12" />
          <path d="M21 18.4c0-1.7 1.4-3.1 3.1-3.1 1.4 0 2.6.9 3 2.2m3.4-1.4c.7-1.5 2.2-2.4 3.9-2.2 1.6.2 2.8 1.2 3.4 2.6m4.2.8c.8-1 2.2-1.5 3.5-1 1.5.6 2.3 2.2 1.8 3.7" fill="none" stroke="#5b341f" strokeWidth="2" strokeLinecap="round" />
          <path d="M24 34h5.6M34.4 34H40" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          <circle cx="27" cy="34.3" r="3.2" fill="none" stroke="#0f172a" strokeWidth="1.8" />
          <circle cx="37" cy="34.3" r="3.2" fill="none" stroke="#0f172a" strokeWidth="1.8" />
          <path d="M32 36l-1 3h2" stroke="#9a5b3d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M28.8 42c2.1 1.4 4.3 1.4 6.4 0" stroke="#7f1d1d" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M17 29.5c3.9.5 7.4 1.7 10.5 3.5M47 29.5c-3.9.5-7.4 1.7-10.5 3.5M17 36.5c3.9.5 7.4 1.8 10.5 3.7M47 36.5c-3.9.5-7.4 1.8-10.5 3.7" stroke="#cbd5e1" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      <span className="whitespace-nowrap">Mangateo</span>
    </Link>
  );
}
