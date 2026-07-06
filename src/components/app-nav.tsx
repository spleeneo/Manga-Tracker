"use client";

import Link from "next/link";
import { BookMarked, Compass, Shield } from "lucide-react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Library", icon: BookMarked },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/settings/parental-controls", label: "Parental controls", icon: Shield },
];

export function AppNav({ isChild = false }: { isChild?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="Primary navigation">
      {navItems.filter((item) => !isChild || item.href !== "/settings/parental-controls").map((item) => {
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
