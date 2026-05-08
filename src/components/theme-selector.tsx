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
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const storedTheme = (localStorage.getItem(storageKey) as Theme | null) ?? "system";
    applyTheme(storedTheme);
    window.queueMicrotask(() => setTheme(storedTheme));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(storageKey) ?? "system") === "system") {
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

  const options: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="flex rounded-lg border bg-muted/50 p-1 shadow-sm" aria-label="Theme selector">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setSelectedTheme(option.value)}
          aria-pressed={theme === option.value}
          title={option.label}
          className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${theme === option.value
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-card hover:text-foreground"
            }`}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
