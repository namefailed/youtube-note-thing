import "@fontsource-variable/inter";
import "./styles/theme.css";

// In a plain browser (vite dev, no Tauri) install the mock IPC bridge BEFORE
// the app boots, so the preview runs with seeded data. Tree-shaken from prod.
if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
  await import("./devmock");
}
await import("./app");

// Apply the saved theme before first paint (themes live on <html data-theme>).
try {
  const t = JSON.parse(localStorage.getItem("ytnt.settings") || "{}").theme;
  if (t) document.documentElement.dataset.theme = t;
} catch { /* default :root theme */ }
