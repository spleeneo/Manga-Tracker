export function ThemeScript() {
  const code = `
    (() => {
      const storageKey = "mangateo-theme";
      const storedTheme = localStorage.getItem(storageKey);
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : prefersDark ? "dark" : "light";
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.dataset.theme = theme;
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
