export function ThemeScript() {
  const code = `
    (() => {
      const storageKey = "manga-tracker-theme";
      const theme = localStorage.getItem(storageKey) || "system";
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
      document.documentElement.dataset.theme = theme;
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
