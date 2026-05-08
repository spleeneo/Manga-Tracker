"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const storageKey = "mangateo-theme";

function getStoredTheme(): Theme {
  const storedTheme = localStorage.getItem(storageKey);
  return storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
    ? storedTheme
    : "system";
}

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
  document.documentElement.dataset.theme = theme;
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const storedTheme = getStoredTheme();
    applyTheme(storedTheme);
    window.queueMicrotask(() => setTheme(storedTheme));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredTheme() === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setSelectedTheme = (nextTheme: Theme) => {
    localStorage.setItem(storageKey, nextTheme);
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];
  const currentIndex = options.findIndex((option) => option.value === theme);
  const current = options[currentIndex >= 0 ? currentIndex : 0];
  const next = options[(options.indexOf(current) + 1) % options.length];
  const Icon = current.icon;

  return (
    <button
      type="button"
      onClick={() => setSelectedTheme(next.value)}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
      title={`Theme: ${current.label}. Click for ${next.label}.`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
