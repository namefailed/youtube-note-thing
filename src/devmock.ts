// Browser-preview mock of the Tauri IPC bridge — DEV ONLY, never bundled in
// prod (main.ts imports it behind `import.meta.env.DEV` + "no Tauri" checks).
// Lets the full UI run with seeded data in a plain browser (vite on :5191),
// where `window.__TAURI_INTERNALS__` doesn't exist. In-memory only.
import type { Note, Video, VideoWithCount } from "./api";

const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();

// Real YouTube ids so thumbnails (i.ytimg.com) and the iframe player resolve.
const videos: Omit<VideoWithCount, "note_count">[] = [
  { id: "aqz-KE-bpKQ", title: "Big Buck Bunny — Blender Open Movie", channel: "Blender", url: "https://youtu.be/aqz-KE-bpKQ", duration: 635, last_pos_secs: 212, manual_order: false, tags: ["dev", "3d"], ext_ref: '{"integration":"phoneme","ref":"rec_demo1"}', pinned: true, view_count: 8_412_000, published_at: iso(2100) },
  { id: "LXb3EKWsInQ", title: "Costa Rica in 4K 60fps HDR (ULTRA HD)", channel: "Jacob + Katie Schwarz", url: "https://youtu.be/LXb3EKWsInQ", duration: 312, last_pos_secs: 0, manual_order: false, tags: ["travel"], ext_ref: null, pinned: false, view_count: 25_301_554, published_at: iso(900) },
  { id: "fJ9rUzIMcZQ", title: "Queen – Bohemian Rhapsody (Official Video Remastered)", channel: "Queen Official", url: "https://youtu.be/fJ9rUzIMcZQ", duration: 359, last_pos_secs: 184, manual_order: false, tags: ["music"], ext_ref: null, pinned: false, view_count: 1_700_000_000, published_at: iso(5000) },
  { id: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up", channel: "Rick Astley", url: "https://youtu.be/dQw4w9WgXcQ", duration: 213, last_pos_secs: 0, manual_order: false, tags: ["music", "watch-later"], ext_ref: null, pinned: false, view_count: 1_400_000_000, published_at: iso(6200) },
  { id: "jNQXAC9IVRw", title: "Me at the zoo", channel: "jawed", url: "https://youtu.be/jNQXAC9IVRw", duration: 19, last_pos_secs: 0, manual_order: false, tags: [], ext_ref: null, pinned: false, view_count: 320_000_000, published_at: iso(7300) },
  { id: "9bZkp7q19f0", title: "PSY - GANGNAM STYLE (강남스타일) M/V — an intentionally long title to exercise truncation in the library card layout", channel: "officialpsy", url: "https://youtu.be/9bZkp7q19f0", duration: 253, last_pos_secs: 97, manual_order: false, tags: ["music"], ext_ref: null, pinned: false, view_count: 5_200_000_000, published_at: iso(4500) },
  { id: "1La4QzGeaaQ", title: "Untitled import (no metadata yet)", channel: null, url: "https://youtu.be/1La4QzGeaaQ", duration: null, last_pos_secs: 0, manual_order: false, tags: ["watch-later"], ext_ref: null, pinned: false, view_count: null, published_at: null },
];

let noteN = 0;
const mkNote = (video_id: string, t_secs: number, content: string): Note => ({ id: `mock-n${++noteN}`, video_id, t_secs, content, order_index: noteN });
const notes: Record<string, Note[]> = {
  "aqz-KE-bpKQ": [
    mkNote("aqz-KE-bpKQ", 34, "Opening shot — **great** color grading reference"),
    mkNote("aqz-KE-bpKQ", 128, "The butterfly rig: see [Blender docs](https://docs.blender.org) for the `constraint` setup"),
    mkNote("aqz-KE-bpKQ", 305, "Rodent physics gag starts here\n\n- squash & stretch\n- exaggerated anticipation"),
  ],
  "fJ9rUzIMcZQ": [
    mkNote("fJ9rUzIMcZQ", 49, "A cappella intro ends"),
    mkNote("fJ9rUzIMcZQ", 184, "Opera section — the *Galileo* build"),
  ],
  "9bZkp7q19f0": [mkNote("9bZkp7q19f0", 71, "chorus")],
};

const withCount = (v: Omit<VideoWithCount, "note_count">): VideoWithCount => ({ ...v, note_count: (notes[v.id] ?? []).length });
const asVideo = (v: Omit<VideoWithCount, "note_count">): Video => ({ id: v.id, title: v.title, channel: v.channel, url: v.url, duration: v.duration, last_pos_secs: v.last_pos_secs, manual_order: v.manual_order, tags: v.tags, ext_ref: v.ext_ref });
const find = (id: string) => videos.find((v) => v.id === id);

/* eslint-disable @typescript-eslint/no-explicit-any */
const handlers: Record<string, (a: any) => unknown> = {
  list_videos: () => videos.map(withCount),
  upsert_video: ({ id, url }) => {
    let v = find(id);
    if (!v) { v = { id, title: "", channel: null, url, duration: null, last_pos_secs: 0, manual_order: false, tags: [], ext_ref: null, pinned: false, view_count: null, published_at: null }; videos.unshift(v); }
    return asVideo(v);
  },
  set_video_title: ({ id, title }) => { const v = find(id); if (v) v.title = title; },
  set_last_pos: ({ id, secs }) => { const v = find(id); if (v) v.last_pos_secs = secs; },
  set_pinned: ({ id, pinned }) => { const v = find(id); if (v) v.pinned = pinned; },
  set_video_tags: ({ id, tags }) => { const v = find(id); if (v) v.tags = tags; },
  set_ext_ref: ({ id, extRef }) => { const v = find(id); if (v) v.ext_ref = extRef; },
  delete_video: ({ id }) => { const i = videos.findIndex((v) => v.id === id); if (i >= 0) videos.splice(i, 1); delete notes[id]; },
  list_notes: ({ videoId }) => [...(notes[videoId] ?? [])].sort((a, b) => a.t_secs - b.t_secs),
  create_note: ({ videoId, tSecs, content }) => { const n = mkNote(videoId, tSecs, content); (notes[videoId] ??= []).push(n); return n; },
  update_note: ({ id, content }) => { for (const arr of Object.values(notes)) { const n = arr.find((x) => x.id === id); if (n) n.content = content; } },
  delete_note: ({ id }) => { for (const arr of Object.values(notes)) { const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr.splice(i, 1); } },
  reorder_notes: () => undefined, reset_order: () => undefined,
  search_notes: ({ query }) => {
    const q = String(query).toLowerCase();
    return Object.values(notes).flat().filter((n) => n.content.toLowerCase().includes(q)).slice(0, 50)
      .map((n) => ({ note_id: n.id, video_id: n.video_id, video_title: find(n.video_id)?.title ?? n.video_id, t_secs: n.t_secs, content: n.content }));
  },
  export_json: () => JSON.stringify({ videos: videos.map(asVideo), notes: Object.values(notes).flat() }, null, 2),
  import_json: () => ({ added_videos: 0, skipped_videos: videos.length, added_notes: 0, skipped_notes: 0 }),
  save_markdown: () => { throw "Not available in the browser preview"; },
  // Integrations: absent/disconnected — the honest preview state.
  phoneme_probe: () => ({ present: false, daemon_ok: false, version: "", compatible: true, path: "" }),
  phoneme_tags: () => [], phoneme_recipes: () => [], set_phoneme_bin: () => undefined,
  phoneme_find_recording: () => null,
  google_status: () => false, google_has_default: () => false,
  video_playlists: () => [],
  youtube_captions: () => { throw "No captions available for this video"; },
};

(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
  invoke: async (cmd: string, args?: unknown) => {
    if (cmd.startsWith("plugin:")) return cmd === "plugin:event|listen" ? 1 : null;
    const h = handlers[cmd];
    if (!h) throw `mock: “${cmd}” not available in the browser preview`;
    return h(args ?? {});
  },
  transformCallback: (() => { let n = 0; return () => ++n; })(),
};
console.info("[ytnt devmock] Tauri bridge mocked — browser preview with seeded data");
