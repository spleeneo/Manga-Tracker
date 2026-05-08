export function ThemeScript() {
  const code = `
    (() => {
      const storageKey = "mangateo-theme";
      const legacyStorageKey = "manga-tracker-theme";
      const legacyTheme = localStorage.getItem(legacyStorageKey);
      const theme = localStorage.getItem(storageKey) || legacyTheme || "system";
      if (legacyTheme && !localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, legacyTheme);
      }
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
      document.documentElement.dataset.theme = theme;
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
