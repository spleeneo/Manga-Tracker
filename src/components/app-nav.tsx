"use client";

import Link from "next/link";
import { BookMarked, Compass } from "lucide-react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Library", icon: BookMarked },
  { href: "/explore", label: "Explore", icon: Compass },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="Primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`app-nav-link ${isActive ? "app-nav-link-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            title={item.label}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
