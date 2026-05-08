"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const storageKey = "manga-tracker-theme";

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
  document.documentElement.dataset.theme = theme;
}

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(storageKey) as Theme | null) ?? "system";
  });

  useEffect(() => {
    const storedTheme = theme;
    applyTheme(storedTheme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(storageKey) ?? "system") === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setSelectedTheme = (nextTheme: Theme) => {
    localStorage.setItem(storageKey, nextTheme);
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const options: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="flex rounded-md border border-input bg-card p-1 shadow-sm" aria-label="Theme selector">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setSelectedTheme(option.value)}
          aria-pressed={theme === option.value}
          title={option.label}
          className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-sm px-2.5 text-xs font-bold transition-colors ${theme === option.value
            ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
