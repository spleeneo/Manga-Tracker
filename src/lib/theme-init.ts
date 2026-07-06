export const THEME_STORAGE_KEY = "mangateo-theme";

export const themeInitScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
    const theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch {}
})();`;
