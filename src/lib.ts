// Pure helpers: URL parsing, time formatting, capture offset, timestamp links.
// TODO: re-add unit coverage as a vitest test (see plans/TESTING_STRATEGY.md).

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
