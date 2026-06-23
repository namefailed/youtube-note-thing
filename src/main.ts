import "@fontsource-variable/inter";
import "./styles/theme.css";
import "./app";

// Apply the saved theme before first paint (themes live on <html data-theme>).
try {
  const t = JSON.parse(localStorage.getItem("ytnt.settings") || "{}").theme;
  if (t) document.documentElement.dataset.theme = t;
} catch { /* default :root theme */ }
