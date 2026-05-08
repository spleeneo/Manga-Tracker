"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const storageKey = "mangateo-theme";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  const storedTheme = localStorage.getItem(storageKey);
  return storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : null;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const selectedTheme = getStoredTheme() ?? getSystemTheme();
    applyTheme(selectedTheme);
    window.queueMicrotask(() => setTheme(selectedTheme));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!getStoredTheme()) {
        const systemTheme = getSystemTheme();
        applyTheme(systemTheme);
        setTheme(systemTheme);
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

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Moon : Sun;
  const currentLabel = theme === "dark" ? "Dark" : "Light";
  const nextLabel = nextTheme === "dark" ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={() => setSelectedTheme(nextTheme)}
      aria-label={`Theme: ${currentLabel}. Switch to ${nextLabel}.`}
      title={`Theme: ${currentLabel}. Click for ${nextLabel}.`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
