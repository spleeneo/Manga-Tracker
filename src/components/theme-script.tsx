export function ThemeScript() {
  const code = `
    (() => {
      const storageKey = "mangateo-theme";
      const storedTheme = localStorage.getItem(storageKey);
      const theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
      document.documentElement.dataset.theme = theme;
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
