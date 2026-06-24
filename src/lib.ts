// Pure helpers: URL parsing, time formatting, capture offset, timestamp links.

// A video's link to an external backend. Stored in videos.ext_ref as JSON
// ({"integration":"phoneme","ref":"<id>"}) so a second backend can coexist and
// the link is self-describing. Legacy rows hold a bare recording id string.
export interface ExtRef { integration: string; ref: string; }
export function parseRef(extRef: string | null | undefined): ExtRef | null {
  if (!extRef) return null;
  try {
    const o = JSON.parse(extRef) as { integration?: unknown; ref?: unknown };
    if (o && typeof o === "object" && typeof o.ref === "string" && o.ref) {
      return { integration: typeof o.integration === "string" ? o.integration : "phoneme", ref: o.ref };
    }
  } catch { /* not JSON — fall through to the legacy bare-string form */ }
  return { integration: "phoneme", ref: extRef };
}
export function serializeRef(ref: string, integration = "phoneme"): string {
  return JSON.stringify({ integration, ref });
}

// --- Tags --------------------------------------------------------------------
// ytnt mirrors Phoneme's tag colors so a tag means/looks the same in both apps.
// Phoneme stores a free hex per tag (native color picker, default mauve); these
// helpers are ported 1:1 so the chips render identically.

/** Phoneme's default tag color (catppuccin mauve) — new tags start here. */
export const DEFAULT_TAG_COLOR = "#cba6f7";

/** A tag color is spliced into inline `style`, so only let a validated hex
 *  through; anything else falls back. Mirrors Phoneme's `safeTagColor`. */
export function safeTagColor(color: string | null | undefined, fallback = "var(--accent)"): string {
  return color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}

/** Black (`#11111b`) or white (`#ffffff`) ink for text on `hex`, by YIQ luma;
 *  `""` for non-hex input (caller inherits). Mirrors Phoneme's contrast helper. */
export function tagInk(hex: string): string {
  if (!hex || !hex.startsWith("#")) return "";
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "";
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? "#11111b" : "#ffffff";
}

export function parsePlaylistId(input: string): string | null {
  if (!input) return null;
  const m = String(input).match(/[?&]list=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export function parseVideoId(input: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") {
      const v = u.searchParams.get("v");
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    }
    const m = u.pathname.match(/^\/(?:shorts|embed|v|live)\/([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

export function formatTime(secs: number): string {
  secs = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function applyOffset(secs: number, offset: number): number {
  return Math.max(0, (Number(secs) || 0) - (Number(offset) || 0));
}

export function tsLink(videoId: string, secs: number): string {
  return `https://youtu.be/${videoId}?t=${Math.floor(secs)}`;
}

/** Render one video's notes as Markdown — the universal PKM export. */
export function notesToMarkdown(
  video: { id: string; title?: string; url?: string },
  notes: { t_secs: number; content: string }[],
): string {
  const out = [`# ${video.title || video.id}`, ""];
  if (video.url) out.push(video.url, "");
  out.push("## Notes", "");
  for (const n of [...notes].sort((a, b) => a.t_secs - b.t_secs)) {
    out.push(`- [${formatTime(n.t_secs)}](${tsLink(video.id, n.t_secs)}) ${n.content}`);
  }
  return out.join("\n") + "\n";
}
