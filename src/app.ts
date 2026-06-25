import { LitElement, html, css, svg, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { api, type VideoWithCount, type Note, type SearchHit, type Segment, type Chapter, type PhonemeHit, type GPlaylist, type PlaylistItem, type PlaylistRef, type PhonemeRec, type TranscriptVersion, type PhonemeProbe } from "./api";
import { Player } from "./player";
import { parseVideoId, parsePlaylistId, parseRef, serializeRef, formatTime, applyOffset, notesToMarkdown, tsLink, safeTagColor, tagInk, DEFAULT_TAG_COLOR, mergeTagSets, formatViews, relativeDate } from "./lib";
import { renderMarkdown } from "./markdown";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { check } from "@tauri-apps/plugin-updater";
import { open as openDialog, confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";

// Lazy + guarded: outside the Tauri runtime (e.g. a browser preview) this is
// absent, and the app must still render rather than fail to define the element.
let _win: ReturnType<typeof getCurrentWindow> | null = null;
function win() {
  try { return (_win ??= getCurrentWindow()); } catch { return null; }
}

const THEMES = [
  "catppuccin-mocha", "catppuccin-macchiato", "catppuccin-frappe", "catppuccin-latte",
  "tokyo-night", "tokyo-night-day", "dracula", "nord", "gruvbox", "gruvbox-light",
  "everforest", "kanagawa", "one-dark", "rose-pine", "rose-pine-dawn", "solarized-light",
];

const I = {
  plus: svg`<svg viewBox="0 0 24 24" class="i"><path d="M12 5v14M5 12h14"/></svg>`,
  search: svg`<svg viewBox="0 0 24 24" class="i"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.2-4.2"/></svg>`,
  edit: svg`<svg viewBox="0 0 24 24" class="i"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  trash: svg`<svg viewBox="0 0 24 24" class="i"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
  up: svg`<svg viewBox="0 0 24 24" class="i"><path d="M18 15l-6-6-6 6"/></svg>`,
  down: svg`<svg viewBox="0 0 24 24" class="i"><path d="M6 9l6 6 6-6"/></svg>`,
  close: svg`<svg viewBox="0 0 24 24" class="i"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  menu: svg`<svg viewBox="0 0 24 24" class="i"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
  chev: svg`<svg viewBox="0 0 24 24" class="i"><path d="M9 6l6 6-6 6"/></svg>`,
  caret: svg`<svg viewBox="0 0 24 24" class="i"><path d="M6 9l6 6 6-6"/></svg>`,
  pin: svg`<svg viewBox="0 0 24 24" class="i"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 16v5"/></svg>`,
  replace: svg`<svg viewBox="0 0 24 24" class="i"><path d="M4 7h11l-3-3M20 17H9l3 3"/></svg>`,
  expand: svg`<svg viewBox="0 0 24 24" class="i"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></svg>`,
  film: svg`<svg viewBox="0 0 24 24" class="i"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16M16 4v16"/></svg>`,
  captions: svg`<svg viewBox="0 0 24 24" class="i"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 11h3M7 14h6M14 11h3"/></svg>`,
  list: svg`<svg viewBox="0 0 24 24" class="i"><path d="M4 6h11M4 12h11M4 18h7M17 13l4 2-4 2z"/></svg>`,
  check: svg`<svg viewBox="0 0 24 24" class="i"><path d="M5 12l5 5L20 7"/></svg>`,
  eye: svg`<svg viewBox="0 0 24 24" class="i"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: svg`<svg viewBox="0 0 24 24" class="i"><path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.1A9.6 9.6 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.1 3.9M6.1 6.1A17 17 0 002 12s4 7 10 7a9.6 9.6 0 003.9-.8"/></svg>`,
  min: svg`<svg viewBox="0 0 24 24" class="i"><path d="M5 12h14"/></svg>`,
  max: svg`<svg viewBox="0 0 24 24" class="i"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`,
  copy: svg`<svg viewBox="0 0 24 24" class="i"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`,
  download: svg`<svg viewBox="0 0 24 24" class="i"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg>`,
  folder: svg`<svg viewBox="0 0 24 24" class="i"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  link: svg`<svg viewBox="0 0 24 24" class="i"><path d="M10.6 13.4a4 4 0 0 0 5.7 0l2.4-2.4a4 4 0 1 0-5.7-5.7l-1.1 1.1"/><path d="M13.4 10.6a4 4 0 0 0-5.7 0l-2.4 2.4a4 4 0 1 0 5.7 5.7l1.1-1.1"/></svg>`,
  gear: svg`<svg viewBox="0 0 24 24" class="i"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.9 7.9 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 2.6h4l.4-2.6a8 8 0 0 0 1.7-1l2.4 1 2-3.4z"/></svg>`,
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function isVisible(el: HTMLElement): boolean {
  return el.checkVisibility ? el.checkVisibility() : el.offsetParent !== null;
}
const LIGHT_THEMES = new Set(["catppuccin-latte", "gruvbox-light", "rose-pine-dawn", "solarized-light", "tokyo-night-day"]);
function themeLabel(slug: string): string {
  return slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

interface Settings { offset: number; autopause: boolean; vaultDir: string; theme: string; stripTitlebar: boolean; gClientId: string; gClientSecret: string; hiddenPlaylists: string[]; phonemeBin: string; syncTags: boolean; }
type Editing = { id?: string; t: number; draft: string } | null;

@customElement("ytnt-app")
export class App extends LitElement {
  @state() private videos: VideoWithCount[] = [];
  @state() private currentId: string | null = null;
  @state() private notes: Note[] = [];
  @state() private editing: Editing = null;
  @state() private filter = "";
  @state() private dur = 0;
  @state() private searchOpen = false;
  @state() private searchResults: SearchHit[] = [];
  @state() private phonemeHits: PhonemeHit[] = [];
  @state() private settingsOpen = false;
  @state() private toasts: { id: number; msg: string; kind: "info" | "ok" | "err" }[] = [];
  private toastN = 0;
  @state() private selectedId: string | null = null;
  @state() private tagFilter: string | null = null;
  @state() private libView: "all" | "transcript" | "untagged" | "tagged" = "all";
  @state() private folds: Record<string, boolean> = {};
  @state() private cheatOpen = false;
  @state() private findReplaceOpen = false;
  @state() private sortDesc = true;
  @state() private selected = new Set<string>();
  @state() private bulkPos: { x: number; y: number } | null = null;
  @state() private fsNote: { t: number } | null = null;
  @state() private titleEditing = false;
  @state() private googleConnected = false;
  @state() private googleHasDefault = false;
  @state() private gplaylists: GPlaylist[] = [];
  @state() private plFilter: GPlaylist | null = null;
  @state() private plItems: PlaylistItem[] = [];
  @state() private plLoading = false;
  @state() private phonemeOk = false;
  // Tag colors: pulled from Phoneme (the authority) so a shared tag looks the
  // same in both apps; local picks (localStorage) win and cover ytnt-only tags.
  @state() private phonemeTagColors: Record<string, string> = {};
  private localTagColors: Record<string, string> = (() => {
    try { return JSON.parse(localStorage.getItem("ytnt.tagColors") || "{}"); } catch { return {}; }
  })();
  private prevDaemonOk = false;
  @state() private tagMgrOpen = false;
  @state() private editingTag: string | null = null;   // detail chip whose editor popover is open
  @state() private editTagName = "";                    // working rename value
  // No Phoneme preset palette exists to copy (its only color set is the rainbow
  // dot); use the 14 Catppuccin Mocha accents the default #cba6f7 belongs to.
  private static readonly PALETTE = [
    "#f38ba8", "#eba0ac", "#fab387", "#f9e2af", "#a6e3a1", "#94e2d5", "#89dceb",
    "#74c7ec", "#89b4fa", "#b4befe", "#cba6f7", "#f5c2e7", "#f2cdcd", "#f5e0dc",
  ];
  // Per-linked-video tag set as of last successful sync — the base for the 3-way
  // merge. Doubles as the durable "queue": local edits that differ from the base
  // while Phoneme is down get pushed on the next reconcile. localStorage, not a
  // catalog/DB — Phoneme stays the tag authority.
  private tagSyncBase: Record<string, string[]> = (() => {
    try { return JSON.parse(localStorage.getItem("ytnt.tagSyncBase") || "{}"); } catch { return {}; }
  })();
  @state() private tagSyncing = false;
  @state() private phonemePresent = false;
  @state() private phonemeCompatible = true;
  @state() private phonemeVersion = "";
  private probeTimer = 0;
  @state() private view: "notes" | "transcript" = "notes";
  @state() private rate = 1;
  @state() private segments: Segment[] = [];
  @state() private transcriptBusy = false;
  @state() private phonemeRec: PhonemeRec | null = null;
  @state() private phonemeVersions: TranscriptVersion[] = [];
  @state() private versionsError = "";
  @state() private chapters: Chapter[] = [];
  @state() private transcriptView: "transcript" | "chapters" | "compare" | "summary" = "transcript";
  @state() private cmpLeft = 0;
  @state() private cmpRight = 0;
  private pollTimer = 0;
  private sseOn = false;
  private unlistenPhoneme: (() => void) | null = null;
  @state() private sidebarOpen = localStorage.getItem("ytnt.sidebar") !== "0";
  @state() private listOpen = localStorage.getItem("ytnt.list") !== "0";

  private player: Player | null = null;
  private lastSaved = 0;
  private lastFocus: HTMLElement | null = null;
  private settings: Settings = loadSettings();

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && (this.searchOpen || this.settingsOpen || this.cheatOpen || this.findReplaceOpen || this.tagMgrOpen)) { this.cheatOpen = false; this.findReplaceOpen = false; this.closeModal(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); this.toggleSidebar(); return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.composedPath()[0] as HTMLElement)?.tagName ?? "");
    if (typing || this.searchOpen || this.settingsOpen || this.cheatOpen || this.findReplaceOpen || this.tagMgrOpen) return;
    if (e.key === "/") { e.preventDefault(); this.openModal("search"); return; }
    if (e.key === "?") { e.preventDefault(); this.cheatOpen = true; return; }
    if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); this.capture(); return; }
    if (!this.currentId) return;
    // Transport — drives the player via its JS API, so it works regardless of
    // whether the iframe or the app has focus (see onFocusIn).
    if (e.key === " ") { e.preventDefault(); this.player?.toggle(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); this.player?.seekBy(e.shiftKey ? -30 : -5); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); this.player?.seekBy(e.shiftKey ? 30 : 5); return; }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); this.changeRate(0.25); return; }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); this.changeRate(-0.25); return; }
    const k = e.key.toLowerCase();
    if (k === "k") { e.preventDefault(); this.player?.toggle(); return; }
    if (k === "j") { e.preventDefault(); this.player?.seekBy(-10); return; }
    if (k === "l") { e.preventDefault(); this.player?.seekBy(10); return; }
    if (k === "m") { e.preventDefault(); this.player?.toggleMute(); return; }
    if (k === "f") { e.preventDefault(); this.toggleFullscreen(); return; }
    if (/^[0-9]$/.test(e.key) && this.dur) { e.preventDefault(); this.player?.seekTo((this.dur * +e.key) / 10); return; }
    // Note selection
    if (this.editing) return;
    const list = this.displayed();
    if (!list.length) return;
    const idx = list.findIndex((n) => n.id === this.selectedId);
    if (e.key === "ArrowDown") { e.preventDefault(); this.select(list[Math.min(list.length - 1, idx + 1)]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.select(list[Math.max(0, idx < 0 ? 0 : idx - 1)]); }
    else if (e.key === "Enter" && idx >= 0) { e.preventDefault(); this.edit(list[idx]); }
    else if (e.key === "Delete" && idx >= 0) { e.preventDefault(); this.del(list[idx].id); }
  };

  // The YouTube iframe steals keyboard focus on click; return it to the app so
  // our shortcuts keep firing. We drive the player via its API, so nothing here
  // needs the iframe to stay focused.
  private onFocusIn = (e: FocusEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && t.tagName === "IFRAME") requestAnimationFrame(() => { try { t.blur(); } catch { /* ignore */ } });
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.onKey, true);
    window.addEventListener("focusin", this.onFocusIn, true);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("focusin", this.onFocusIn, true);
    clearInterval(this.probeTimer);
    this.unlistenPhoneme?.();
    if (this.sseOn) { this.sseOn = false; api.phonemeSseStop().catch(() => {}); }
  }

  /** Probe Phoneme's CLI/daemon/version; flips phonemeOk and the compat flags live. */
  private async probePhoneme() {
    try {
      const p: PhonemeProbe = await api.phonemeProbe();
      this.phonemeOk = p.daemon_ok;
      this.phonemePresent = p.present;
      this.phonemeCompatible = p.compatible;
      this.phonemeVersion = p.version;
      // Pull Phoneme's tag colors when the daemon (re)appears.
      if (p.daemon_ok && !this.prevDaemonOk) { this.refreshTagColors(); this.flushPendingTags(); }
      this.prevDaemonOk = p.daemon_ok;
    } catch {
      this.phonemeOk = false; this.phonemePresent = false; this.prevDaemonOk = false;
    }
  }

  private async refreshTagColors() {
    try {
      const tags = await api.phonemeTags();
      const m: Record<string, string> = {};
      for (const t of tags) if (t.color && /^#[0-9a-fA-F]{3,8}$/.test(t.color)) m[t.name.toLowerCase()] = t.color;
      this.phonemeTagColors = m;
    } catch { /* daemon down — keep whatever colors we already have */ }
  }

  /** Resolved color for a tag, or null (caller uses the theme default tint). */
  private tagColorOf(name: string): string | null {
    const k = name.toLowerCase();
    return this.localTagColors[k] ?? this.phonemeTagColors[k] ?? null;
  }
  /** Inline style for a colored chip; "" when the tag has no color (CSS tint). */
  private chipStyle(name: string): string {
    const c = this.tagColorOf(name);
    return c ? `--tag-color:${safeTagColor(c)};color:${tagInk(c)}` : "";
  }
  private dotColor(name: string): string { return safeTagColor(this.tagColorOf(name)); }
  private setTagColor(name: string, hex: string) {
    this.localTagColors = { ...this.localTagColors, [name.toLowerCase()]: hex };
    localStorage.setItem("ytnt.tagColors", JSON.stringify(this.localTagColors));
    this.requestUpdate();
  }

  // --- Tag membership sync (bidirectional; Phoneme is the catalog authority) ---
  private tagSetEq(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const s = new Set(a.map((x) => x.toLowerCase()));
    return b.every((x) => s.has(x.toLowerCase()));
  }
  private phonemeRef(v: { ext_ref: string | null }): string | null {
    const r = parseRef(v.ext_ref);
    return r && r.integration === "phoneme" ? r.ref : null;
  }
  /** Reconcile one linked video's tags with its Phoneme recording via a 3-way
   *  merge: push local changes, pull remote ones, advance the base snapshot.
   *  Leaves changes pending (returns false, base untouched) when sync is off,
   *  the video is unlinked, or Phoneme is unreachable. Returns whether ytnt's
   *  own tags changed (so the caller can refresh). */
  private async reconcileVideoTags(videoId: string, localOverride?: string[]): Promise<boolean> {
    if (!this.settings.syncTags || !this.phonemeOk) return false;
    const v = this.videos.find((x) => x.id === videoId);
    if (!v) return false;
    const rec = this.phonemeRef(v);
    if (!rec) return false;
    const local = localOverride ?? v.tags;
    let remote: string[];
    try { remote = (await api.phonemeTagsFor(rec)).map((t) => t.name); }
    catch { return false; } // daemon down/error — keep pending, never detach
    const { merged, toAttach, toDetach } = mergeTagSets(this.tagSyncBase[videoId] ?? null, local, remote);
    if (toAttach.length || toDetach.length) {
      const colors: Record<string, string> = {};
      for (const name of toAttach) { const c = this.tagColorOf(name); if (c) colors[name] = c; }
      try { await api.phonemeApplyTags(rec, toAttach, toDetach, colors); }
      catch { return false; } // push failed — don't advance base, retry later
    }
    let changed = false;
    if (!this.tagSetEq(merged, local)) { await api.setVideoTags(videoId, merged); changed = true; }
    this.tagSyncBase = { ...this.tagSyncBase, [videoId]: merged };
    localStorage.setItem("ytnt.tagSyncBase", JSON.stringify(this.tagSyncBase));
    return changed;
  }
  /** Push linked videos whose local tags drifted from the base while Phoneme was
   *  down — the durable "queue" draining when the daemon reappears. */
  private async flushPendingTags() {
    if (!this.settings.syncTags) return;
    let any = false;
    for (const v of this.videos) {
      if (!this.phonemeRef(v)) continue;
      const base = this.tagSyncBase[v.id];
      const pending = base === undefined ? v.tags.length > 0 : !this.tagSetEq(v.tags, base);
      if (pending && await this.reconcileVideoTags(v.id)) any = true;
    }
    if (any) await this.refreshVideos();
  }
  /** "Sync all" — full pull+push across every linked video (Tag Manager button). */
  private async syncAllTags() {
    if (!this.phonemeOk) { this.flash("Phoneme isn't running", "err"); return; }
    this.tagSyncing = true;
    let n = 0;
    for (const v of this.videos) {
      if (!this.phonemeRef(v)) continue;
      try { await this.reconcileVideoTags(v.id); n++; } catch { /* skip one bad video */ }
    }
    await this.refreshVideos();
    this.tagSyncing = false;
    this.flash(`Synced tags for ${n} linked video${n === 1 ? "" : "s"}`, "ok");
  }

  firstUpdated() {
    this.refreshVideos();
    const el = this.renderRoot.querySelector("#player") as HTMLElement;
    this.player = new Player(el);
    this.player.onTick = (t, d) => this.onTick(t, d);
    this.player.onTitle = (title) => this.onTitle(title);
    this.player.onError = (code) => this.onPlayerError(code);
    // Push any saved Phoneme path to the backend before the first probe.
    api.setPhonemeBin(this.settings.phonemeBin).then(() => this.probePhoneme()).catch(() => this.probePhoneme());
    // Re-probe on a timer so a daemon that starts or dies mid-session flips
    // phonemeOk live (not only at startup).
    this.probeTimer = window.setInterval(() => this.probePhoneme(), 15000);
    // Live pipeline progress: phoneme_sse_start bridges phoneme-rest's SSE to a
    // "phoneme-event" Tauri event; refresh on each while a recording is tracked.
    // Best-effort — REST is opt-in, so this no-ops and the 4s poll carries on.
    listen("phoneme-event", () => { if (this.recId()) this.refreshPhoneme(); })
      .then((un) => (this.unlistenPhoneme = un)).catch(() => {});
    win()?.setDecorations(!this.settings.stripTitlebar)?.catch(() => {});
    api.googleStatus().then((ok) => { this.googleConnected = ok; if (ok) { this.loadGPlaylists(); this.syncMissingMeta(); } }).catch(() => {});
    api.googleHasDefault().then((v) => (this.googleHasDefault = v)).catch(() => {});
  }
  private async googleConnect() {
    this.flash("Opening Google sign-in — authorize in your browser…");
    try {
      await api.googleConnect(this.settings.gClientId, this.settings.gClientSecret);
      this.googleConnected = true;
      this.flash("YouTube account connected", "ok");
      this.loadGPlaylists();
    } catch (e) { this.flash(String(e), "err"); }
  }
  private async googleDisconnect() {
    await api.googleLogout();
    this.googleConnected = false; this.gplaylists = [];
    this.flash("Disconnected", "ok");
  }
  private async loadGPlaylists() {
    try { this.gplaylists = await api.googlePlaylists(this.settings.gClientId, this.settings.gClientSecret); }
    catch (e) { this.flash(String(e), "err"); }
  }
  private togglePlaylistHidden(id: string) {
    const h = this.settings.hiddenPlaylists;
    const next = h.includes(id) ? h.filter((x) => x !== id) : [...h, id];
    this.setSetting("hiddenPlaylists", next);
    if (this.plFilter && next.includes(this.plFilter.id)) { this.plFilter = null; this.plItems = []; }
  }
  private get current() { return this.videos.find((v) => v.id === this.currentId) ?? null; }

  private onTick(t: number, d: number) {
    const prog = this.renderRoot.querySelector("#progress") as HTMLElement | null;
    if (prog && d) prog.style.right = `${100 - (t / d) * 100}%`;
    if (Math.abs(d - this.dur) > 1) this.dur = d;
    if (this.currentId && Math.abs(this.lastSaved - t) > 3) {
      this.lastSaved = t;
      api.setLastPos(this.currentId, t).catch(() => {});
    }
  }
  private onTitle(title: string) {
    const v = this.current;
    if (v && !v.title) api.setVideoTitle(v.id, title).then(() => this.refreshVideos());
  }

  private async refreshVideos() { this.videos = await api.listVideos(); }
  /** Backfill YouTube metadata (channel, views, duration, date) for videos that
   *  don't have it yet — needs Google connected; batched, idempotent. */
  private async syncMissingMeta() {
    if (!this.googleConnected) return;
    if (!this.videos.length) await this.refreshVideos();
    const ids = this.videos.filter((v) => v.view_count == null).map((v) => v.id);
    if (!ids.length) return;
    try {
      await api.syncVideoMeta(this.settings.gClientId, this.settings.gClientSecret, ids);
      await this.refreshVideos();
    } catch { /* offline / quota — leave cards as they are */ }
  }
  private async refreshNotes() { this.notes = this.currentId ? await api.listNotes(this.currentId) : []; }

  private async loadVideo(id: string, url?: string) {
    this.currentId = id;
    this.editing = null; this.filter = ""; this.dur = 0; this.lastSaved = 0; this.selectedId = null;
    this.view = "notes"; this.segments = [];
    this.phonemeRec = null; this.phonemeVersions = []; this.versionsError = ""; this.chapters = []; this.transcriptView = "transcript"; clearTimeout(this.pollTimer);
    if (this.sseOn) { this.sseOn = false; api.phonemeSseStop().catch(() => {}); }
    await api.upsertVideo(id, url ?? `https://youtu.be/${id}`);
    await this.refreshVideos();
    this.player?.load(id, this.current?.last_pos_secs ?? 0);
    await this.refreshNotes();
    // Pull/push this video's tags with Phoneme (no-op if unlinked or down).
    this.reconcileVideoTags(id).then((changed) => { if (changed) this.refreshVideos(); });
    this.syncMissingMeta(); // backfill YouTube metadata for any new video (no-op if all cached)
  }

  private async addFromInput() {
    const input = this.renderRoot.querySelector("#url") as HTMLInputElement;
    const raw = input.value.trim();
    const list = parsePlaylistId(raw);
    const id = parseVideoId(raw);
    if (list) {
      input.value = "";
      this.flash("Importing playlist…");
      try {
        const n = await api.importYoutubePlaylist(list);
        await this.refreshVideos();
        this.syncMissingMeta();
        this.flash(n ? `Imported ${n} video${n > 1 ? "s" : ""} from playlist` : "Playlist already in your library", "ok");
      } catch (e) { this.flash(String(e), "err"); }
      if (id) this.loadVideo(id, raw);
      return;
    }
    if (!id) { this.flash("Not a valid YouTube URL", "err"); return; }
    input.value = "";
    this.loadVideo(id, /^https?:/.test(raw) ? raw : `https://youtu.be/${id}`);
  }

  private capture() {
    if (!this.player || !this.currentId) return;
    const t = applyOffset(this.player.currentTime, this.settings.offset);
    if (this.settings.autopause) this.player.pause();
    // In fullscreen the notes pane isn't visible — capture via an overlay that
    // lives inside #playerWrap so it renders on top of the fullscreened video.
    // NOTE: the Fullscreen API retargets document.fullscreenElement to the shadow
    // host (never the inner #playerWrap), so an `=== pw` check is always false in
    // shadow DOM. #playerWrap is the only thing we ever fullscreen, so a truthy
    // fullscreenElement means we're in the video.
    if (document.fullscreenElement) {
      this.fsNote = { t };
      this.updateComplete.then(() => (this.renderRoot.querySelector("#fsNoteInput") as HTMLTextAreaElement)?.focus());
      return;
    }
    this.editing = { t, draft: "" };
    this.updateComplete.then(() =>
      (this.renderRoot.querySelector("#editor textarea") as HTMLTextAreaElement)?.focus());
  }
  private async fsCommit(text: string) {
    const n = this.fsNote; if (!n) return;
    if (text.trim() && this.currentId) await api.createNote(this.currentId, n.t, text.trim());
    this.fsNote = null;
    if (this.settings.autopause) this.player?.play();
    await this.refreshNotes(); await this.refreshVideos();
  }
  private fsCancel() { this.fsNote = null; if (this.settings.autopause) this.player?.play(); }
  private async saveTitle(v: string) {
    this.titleEditing = false;
    const t = v.trim(); const cur = this.current;
    if (!cur || !t || t === cur.title) return;
    await api.setVideoTitle(cur.id, t); await this.refreshVideos();
  }
  private async commit(text: string) {
    const e = this.editing; if (!e) return;
    const isNew = !e.id;
    if (e.id) await api.updateNote(e.id, text.trim());
    else if (text.trim() && this.currentId) await api.createNote(this.currentId, e.t, text.trim());
    this.editing = null;
    if (isNew && this.settings.autopause) this.player?.play();
    await this.refreshNotes(); await this.refreshVideos();
  }
  private cancel() {
    const isNew = this.editing && !this.editing.id;
    this.editing = null;
    if (isNew && this.settings.autopause) this.player?.play();
  }
  private edit(n: Note) {
    this.editing = { id: n.id, t: n.t_secs, draft: n.content };
    this.updateComplete.then(() =>
      (this.renderRoot.querySelector("#editor textarea") as HTMLTextAreaElement)?.focus());
  }
  private async del(id: string) { await api.deleteNote(id); await this.refreshNotes(); await this.refreshVideos(); }

  private async move(n: Note, dir: -1 | 1) {
    const ids = this.notes.map((x) => x.id);
    const i = ids.indexOf(n.id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api.reorderNotes(this.currentId!, ids);
    await this.refreshNotes(); await this.refreshVideos();
  }
  private async resetOrder() { await api.resetOrder(this.currentId!); await this.refreshNotes(); await this.refreshVideos(); }

  private seek(t: number) { this.player?.seekTo(t); this.player?.play(); }

  private displayed(): Note[] {
    return this.filter
      ? this.notes.filter((n) => n.content.toLowerCase().includes(this.filter.toLowerCase()))
      : this.notes;
  }
  private select(n: Note) {
    this.selectedId = n.id;
    this.updateComplete.then(() =>
      this.renderRoot.querySelector(".note.selected")?.scrollIntoView({ block: "nearest" }));
  }

  private async runSearch(q: string) {
    this.searchResults = q.trim() ? await api.searchNotes(q) : [];
    if (q.trim() && this.phonemeOk) { try { this.phonemeHits = await api.phonemeSearch(q); } catch { this.phonemeHits = []; } }
    else this.phonemeHits = [];
  }
  private openPhonemeHit(h: PhonemeHit) {
    const vid = this.videos.find((v) => parseRef(v.ext_ref)?.ref === h.id)?.id;
    if (vid) { this.closeModal(); this.loadVideo(vid); }
    else this.flash("That Phoneme recording isn't linked to a video here.");
  }

  // ── Modal focus management (a11y) ────────────────────────────────────────
  private focusables(): HTMLElement[] {
    const panel = this.renderRoot.querySelector(".overlay .panel") as HTMLElement | null;
    if (!panel) return [];
    return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisible);
  }
  private openModal(which: "search" | "settings" | "tagmgr") {
    this.lastFocus = ((this.renderRoot as ShadowRoot).activeElement as HTMLElement) ?? null;
    if (which === "search") { this.searchResults = []; this.phonemeHits = []; this.searchOpen = true; }
    else if (which === "tagmgr") this.tagMgrOpen = true;
    else this.settingsOpen = true;
    this.updateComplete.then(() => this.focusables()[0]?.focus());
  }
  private closeModal() {
    this.searchOpen = false; this.settingsOpen = false; this.tagMgrOpen = false;
    const target = this.lastFocus; this.lastFocus = null;
    this.updateComplete.then(() => { try { target?.focus(); } catch { /* trigger gone */ } });
  }
  private trapTab(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const items = this.focusables();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = (this.renderRoot as ShadowRoot).activeElement as HTMLElement | null;
    if (!active || !items.includes(active)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }
  private async openHit(h: SearchHit) {
    this.closeModal();
    await this.loadVideo(h.video_id);
    setTimeout(() => this.seek(h.t_secs), 900);
  }

  private async exportJson() { download("ytnt-backup.json", await api.exportJson(), "application/json"); this.flash("Exported backup", "ok"); }
  private async importJson(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await api.importJson(await file.text());
    await this.refreshVideos(); await this.refreshNotes();
    this.flash("Imported backup", "ok");
  }

  private mdForCurrent(): string | null {
    const v = this.current;
    if (!v || !this.notes.length) return null;
    return notesToMarkdown({ id: v.id, title: v.title, url: v.url }, this.notes);
  }
  private async copyMd() {
    const md = this.mdForCurrent(); if (!md) return;
    await navigator.clipboard.writeText(md); this.flash("Copied Markdown", "ok");
  }
  private async copyLink(n: Note) {
    if (!this.currentId) return;
    await navigator.clipboard.writeText(tsLink(this.currentId, n.t_secs)); this.flash("Copied timestamp link");
  }
  private downloadMd() {
    const md = this.mdForCurrent(); if (!md) return;
    download(`${this.currentSlug()}.md`, md, "text/markdown"); this.flash("Saved .md", "ok");
  }
  private currentSlug(): string {
    const v = this.current; if (!v) return "notes";
    return (v.title || v.id).replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || v.id;
  }
  private async saveToVault() {
    const md = this.mdForCurrent(); const dir = this.settings.vaultDir?.trim();
    if (!md || !dir) return;
    try { const path = await api.saveMarkdown(dir, `${this.currentSlug()}.md`, md); this.flash(`Saved → ${path}`, "ok"); }
    catch (e) { this.flash(String(e), "err"); }
  }

  // ── Phoneme integration (optional) ──────────────────────────────────────
  private recId(): string | null {
    const r = parseRef(this.current?.ext_ref);
    return r && r.integration === "phoneme" ? r.ref : null;
  }
  private async setRecId(rec: string) {
    if (!this.currentId) return;
    await api.setExtRef(this.currentId, serializeRef(rec));
    await this.refreshVideos();
  }
  /** Drop a video's link to a Phoneme recording that no longer exists. */
  private async unlinkRef() {
    if (!this.currentId) return;
    await api.setExtRef(this.currentId, null);
    this.phonemeRec = null; this.segments = []; this.phonemeVersions = []; this.chapters = [];
    await this.refreshVideos();
    this.flash("Unlinked from Phoneme — you can transcribe again.", "ok");
  }
  /** The linked recording id no longer resolves in Phoneme — offer to unlink. */
  private async offerUnlinkDeadRef() {
    let yes = false;
    try {
      yes = await confirmDialog(
        "This video is linked to a Phoneme recording that no longer exists. Unlink it?",
        { title: "Recording not found", kind: "warning" });
    } catch { /* dialog unavailable — leave the link, just notify */ }
    if (yes) await this.unlinkRef();
    else this.flash("Phoneme recording not found.", "err");
  }
  private async sendToPhoneme() {
    const v = this.current; if (!v) return;
    this.transcriptBusy = true; this.flash("Sending to Phoneme — downloading + queuing…");
    try { const rec = await api.phonemeImport(v.url); await this.setRecId(rec); await this.refreshPhoneme(); this.flash("Queued — transcribing in Phoneme", "ok"); }
    catch (e) { this.flash(String(e), "err"); }
    finally { this.transcriptBusy = false; }
  }
  private openTranscript() {
    this.view = "transcript";
    if (this.recId() && !this.phonemeRec) this.refreshPhoneme();
  }
  /** Poll the recording until the pipeline is terminal, then pull segments + versions. */
  private async refreshPhoneme() {
    const rec = this.recId(); if (!rec) { clearTimeout(this.pollTimer); return; }
    try { this.phonemeRec = await api.phonemeRecording(rec); }
    catch (e) {
      clearTimeout(this.pollTimer);
      const msg = String(e);
      // The daemon is up (phonemeOk) but the linked recording no longer resolves
      // → a dead ext_ref. Offer to unlink rather than leaving a broken link.
      if (this.phonemeOk && /not\s*found|no\s+recording|unknown/i.test(msg)) {
        this.offerUnlinkDeadRef();
      } else {
        this.flash(msg, "err");
      }
      return;
    }
    if (/^(done|.*_failed|cancelled)$/.test(this.phonemeRec.status)) {
      clearTimeout(this.pollTimer);
      if (this.sseOn) { this.sseOn = false; api.phonemeSseStop().catch(() => {}); }
      try { this.segments = await api.phonemeSegments(rec); } catch { /* may have no timing */ }
      try {
        this.phonemeVersions = await api.phonemeVersions(rec);
        this.versionsError = "";
        this.cmpLeft = 0; this.cmpRight = Math.max(0, this.phonemeVersions.length - 1);
      } catch (e) { this.phonemeVersions = []; this.versionsError = String(e); }
      try { this.chapters = await api.phonemeChapters(rec); } catch { this.chapters = []; }
    } else {
      // In flight: prefer live SSE updates; keep the 4s poll as the fallback.
      if (!this.sseOn) { this.sseOn = true; api.phonemeSseStart().catch(() => { this.sseOn = false; }); }
      clearTimeout(this.pollTimer);
      this.pollTimer = window.setTimeout(() => this.refreshPhoneme(), 4000);
    }
  }
  private stageLabel(s: string): string {
    const m: Record<string, string> = { queued: "Queued…", transcribing: "Transcribing…", cleaning_up: "Cleaning up the transcript…", summarizing: "Summarizing…", tagging: "Tagging…", hook_running: "Running hooks…", cancelled: "Cancelled" };
    return m[s] ?? (s.endsWith("_failed") ? "A step failed — the transcript may still be usable" : s);
  }
  private async loadCaptions() {
    if (!this.currentId) return;
    this.transcriptBusy = true;
    try { this.segments = await api.youtubeCaptions(this.currentId); }
    catch (e) { this.segments = []; this.flash(String(e), "err"); }
    finally { this.transcriptBusy = false; }
  }

  private setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
    this.settings = { ...this.settings, [k]: v };
    localStorage.setItem("ytnt.settings", JSON.stringify(this.settings));
    if (k === "theme") document.documentElement.dataset.theme = String(v);
    if (k === "stripTitlebar") win()?.setDecorations(!v)?.catch(() => {});
    if (k === "phonemeBin") api.setPhonemeBin(String(v)).then(() => this.probePhoneme()).catch(() => {});
    this.requestUpdate();
  }
  private flash(msg: string, kind: "info" | "ok" | "err" = "info") {
    const id = ++this.toastN;
    this.toasts = [...this.toasts, { id, msg, kind }];
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 2800);
  }
  private async checkUpdates() {
    this.flash("Checking for updates…");
    try {
      const update = await check();
      if (!update) { this.flash("You're on the latest version"); return; }
      this.flash(`Downloading update ${update.version}…`);
      await update.downloadAndInstall();
      this.flash("Update installed — restart to apply");
    } catch (e) { this.flash(`Update check failed: ${e}`, "err"); }
  }
  private changeRate(d: number) {
    if (!this.player) return;
    const r = Math.min(3, Math.max(0.25, +(this.player.getRate() + d).toFixed(2)));
    this.player.setRate(r); this.rate = r; this.flash(`Speed ${r}×`);
  }
  private setSpeed(r: number) { this.player?.setRate(r); this.rate = r; this.flash(`Speed ${r}×`); }
  private closeMenu(e: Event) { (e.target as HTMLElement).closest("details")?.removeAttribute("open"); }
  private async togglePin(id: string, pinned: boolean) { await api.setPinned(id, !pinned); await this.refreshVideos(); }
  private async browseVault() {
    try { const dir = await openDialog({ directory: true }); if (typeof dir === "string") this.setSetting("vaultDir", dir); }
    catch (e) { this.flash(String(e), "err"); }
  }
  private async openVault() {
    if (!this.settings.vaultDir) return;
    try { await openPath(this.settings.vaultDir); } catch (e) { this.flash(String(e), "err"); }
  }
  private async runReplace(find: string, repl: string) {
    if (!find || !this.currentId) return;
    let n = 0;
    for (const note of this.notes) {
      if (note.content.includes(find)) { await api.updateNote(note.id, note.content.split(find).join(repl)); n++; }
    }
    await this.refreshNotes();
    this.findReplaceOpen = false;
    this.flash(n ? `Replaced in ${n} note${n > 1 ? "s" : ""}` : "No matches", n ? "ok" : "info");
  }
  private toggleSelect(id: string) {
    const s = new Set(this.selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    this.selected = s;
  }
  private async bulkDelete() {
    const ids = [...this.selected];
    for (const id of ids) { if (id === this.currentId) this.deselect(); await api.deleteVideo(id); }
    this.selected = new Set();
    await this.refreshVideos();
    this.flash(`Deleted ${ids.length} video${ids.length > 1 ? "s" : ""}`, "ok");
  }
  private async bulkTag(name: string) {
    const t = name.trim(); if (!t) return;
    const n = this.selected.size;
    for (const id of this.selected) {
      const v = this.videos.find((x) => x.id === id);
      if (v && !v.tags.includes(t)) await api.setVideoTags(id, [...v.tags, t]);
    }
    await this.refreshVideos();
    for (const id of this.selected) {
      const v = this.videos.find((x) => x.id === id);
      if (v && this.phonemeRef(v)) await this.reconcileVideoTags(id);
    }
    await this.refreshVideos();
    this.flash(`Tagged ${n} video${n > 1 ? "s" : ""} “${t}”`, "ok");
  }
  private bulkDrag(e: MouseEvent) {
    e.preventDefault();
    const bar = (e.currentTarget as HTMLElement).closest(".bulkbar") as HTMLElement | null;
    const rect = bar?.getBoundingClientRect();
    const base = this.bulkPos ?? { x: rect?.left ?? 0, y: rect?.top ?? 0 };
    const sx = e.clientX, sy = e.clientY;
    const move = (m: MouseEvent) => { this.bulkPos = {
      x: Math.max(8, Math.min(window.innerWidth - 140, base.x + m.clientX - sx)),
      y: Math.max(8, Math.min(window.innerHeight - 48, base.y + m.clientY - sy)),
    }; };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }
  private onPlayerError(code: number) {
    const msg: Record<number, string> = {
      2: "Invalid video URL", 5: "Playback error", 100: "Video not found or removed",
      101: "Embedding disabled by the owner", 150: "Embedding disabled by the owner",
    };
    this.flash(msg[code] ?? "Player error", "err");
    if ((code === 101 || code === 150) && this.currentId)
      window.open(`https://www.youtube.com/watch?v=${this.currentId}`, "_blank");
  }
  private toggleFullscreen() {
    const el = this.renderRoot.querySelector("#playerWrap") as HTMLElement | null;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  private onNotesClick(e: Event) {
    const a = e.composedPath().find((n) => (n as HTMLElement).tagName === "A") as HTMLAnchorElement | undefined;
    if (a?.href) { e.preventDefault(); window.open(a.href, "_blank"); }
  }
  private timelineClick(e: MouseEvent) {
    if (!this.player || !this.dur) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.seek(((e.clientX - r.left) / r.width) * this.dur);
  }
  private async removeVideo(id: string) {
    let pls: PlaylistRef[] = [];
    try { pls = await api.videoPlaylists(id); } catch { /* offline / not connected */ }
    let alsoRemove = false;
    if (pls.length) {
      try {
        alsoRemove = await confirmDialog(
          `Also remove it from your YouTube playlist${pls.length > 1 ? "s" : ""}: ${pls.map((p) => p.playlist_title).join(", ")}?`,
          { title: "Remove from playlist?", kind: "warning" });
      } catch { /* dialog unavailable */ }
    }
    await api.deleteVideo(id);
    if (alsoRemove) {
      for (const p of pls) {
        try { await api.googleRemovePlaylistItem(this.settings.gClientId, this.settings.gClientSecret, p.playlist_id, id, p.item_id); }
        catch (e) { this.flash(String(e), "err"); }
      }
      this.flash("Removed from playlist", "ok");
    }
    if (this.currentId === id) { this.currentId = null; this.notes = []; }
    this.plItems = this.plItems.map((x) => (x.video_id === id ? { ...x, in_library: false } : x));
    await this.refreshVideos();
  }
  private async openPlaylist(p: GPlaylist) {
    if (this.plFilter?.id === p.id) { this.plFilter = null; this.plItems = []; return; }
    this.plFilter = p; this.tagFilter = null; this.libView = "all"; this.plItems = []; this.plLoading = true;
    try { this.plItems = await api.googleSyncPlaylist(this.settings.gClientId, this.settings.gClientSecret, p.id, p.title); }
    catch (e) { this.flash(String(e), "err"); this.plFilter = null; }
    this.plLoading = false;
  }
  private async togglePlItem(it: PlaylistItem) {
    try {
      if (it.in_library) { await api.deleteVideo(it.video_id); if (this.currentId === it.video_id) this.deselect(); }
      else await api.upsertVideo(it.video_id, `https://youtu.be/${it.video_id}`);
      this.plItems = this.plItems.map((x) => (x.video_id === it.video_id ? { ...x, in_library: !it.in_library } : x));
      await this.refreshVideos();
    } catch (e) { this.flash(String(e), "err"); }
  }
  /** Remove a video from the OPEN YouTube playlist (not the library). For the
   *  "done taking notes — drop it from my to-do playlist" workflow. */
  private async removeFromPlaylist(it: PlaylistItem) {
    const pl = this.plFilter;
    if (!pl) return;
    let ok = true;
    try {
      ok = await confirmDialog(`Remove “${it.title}” from “${pl.title}”? It stays in your library.`,
        { title: "Remove from playlist?", kind: "warning" });
    } catch { /* dialog unavailable — honor the click */ }
    if (!ok) return;
    try {
      await api.googleRemovePlaylistItem(this.settings.gClientId, this.settings.gClientSecret, pl.id, it.video_id, it.item_id);
      this.plItems = this.plItems.filter((x) => x.item_id !== it.item_id);
      this.gplaylists = this.gplaylists.map((g) => (g.id === pl.id ? { ...g, count: Math.max(0, g.count - 1) } : g));
      this.flash(`Removed from “${pl.title}”`, "ok");
    } catch (e) { this.flash(String(e), "err"); }
  }
  private toggleVideo(id: string, url: string) {
    if (id === this.currentId) this.deselect();
    else this.loadVideo(id, url);
  }
  private deselect() {
    this.currentId = null; this.notes = []; this.segments = [];
    this.view = "notes"; this.editing = null; this.selectedId = null;
    this.player?.pause();
  }
  private toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    localStorage.setItem("ytnt.sidebar", this.sidebarOpen ? "1" : "0");
  }
  private toggleList() {
    this.listOpen = !this.listOpen;
    localStorage.setItem("ytnt.list", this.listOpen ? "1" : "0");
  }
  /** "Fullscreen the video panel": collapse both side columns, or restore them. */
  private toggleFocus() {
    const focused = !this.sidebarOpen && !this.listOpen;
    this.sidebarOpen = focused; this.listOpen = focused;
    localStorage.setItem("ytnt.sidebar", this.sidebarOpen ? "1" : "0");
    localStorage.setItem("ytnt.list", this.listOpen ? "1" : "0");
  }
  private toggleFold(k: string) { this.folds = { ...this.folds, [k]: !this.folds[k] }; }
  updated() {
    this.toggleAttribute("collapsed", !this.sidebarOpen);
    this.toggleAttribute("nolist", !this.listOpen);
  }
  private allTags(): string[] {
    return [...new Set(this.videos.flatMap((v) => v.tags))].sort((a, b) => a.localeCompare(b));
  }
  private async addTag(name: string) {
    const v = this.current; const t = name.trim();
    if (!v || !t || v.tags.includes(t)) return;
    const next = [...v.tags, t];
    await api.setVideoTags(v.id, next);
    await this.reconcileVideoTags(v.id, next);
    await this.refreshVideos();
  }
  private async removeTag(name: string) {
    const v = this.current; if (!v) return;
    const next = v.tags.filter((x) => x !== name);
    await api.setVideoTags(v.id, next);
    await this.reconcileVideoTags(v.id, next);
    await this.refreshVideos();
  }
  private startTagEdit(name: string, e: Event) {
    e.stopPropagation();
    this.editingTag = this.editingTag === name ? null : name;
    this.editTagName = name;
    this.updateComplete.then(() => (this.renderRoot.querySelector(".tag-edit-name") as HTMLInputElement)?.focus());
  }
  private cancelTagEdit() { this.editingTag = null; }
  /** Rename a tag everywhere — ytnt has no tags table, so rewrite every video's
   *  tags array and migrate the local color override. Local only; Phoneme's
   *  catalog is untouched (no write route). */
  private async renameTag(oldName: string, raw: string) {
    const next = raw.trim();
    this.editingTag = null;
    if (!next || next === oldName) return;
    for (const v of this.videos) {
      if (!v.tags.includes(oldName)) continue;
      await api.setVideoTags(v.id, [...new Set(v.tags.map((x) => (x === oldName ? next : x)))]);
    }
    const ok = oldName.toLowerCase(), nk = next.toLowerCase();
    if (this.localTagColors[ok] && ok !== nk) {
      const { [ok]: c, ...rest } = this.localTagColors;
      this.localTagColors = { ...rest, [nk]: c };
      localStorage.setItem("ytnt.tagColors", JSON.stringify(this.localTagColors));
    }
    if (this.tagFilter === oldName) this.tagFilter = next;
    // If Phoneme knows this tag, rename it globally there too (same id + all
    // attachments) instead of letting reconcile detach the old + attach the new,
    // which would orphan the old tag in Phoneme's catalog.
    if (this.settings.syncTags && this.phonemeOk) {
      try {
        const t = (await api.phonemeTags()).find((x) => x.name.toLowerCase() === ok);
        if (t) await api.phonemeUpdateTag(t.id, next, this.tagColorOf(next) ?? t.color);
      } catch { /* leave it — next reconcile converges */ }
    }
    await this.refreshVideos();
    this.flash("Tag renamed", "ok");
  }

  render() {
    const filtered = this.displayed();
    const tags = this.allTags();
    const transcriptCount = this.videos.filter((v) => v.ext_ref).length;
    const untaggedCount = this.videos.filter((v) => v.tags.length === 0).length;
    const taggedCount = this.videos.length - untaggedCount;
    let vids = this.videos;
    if (this.libView === "transcript") vids = vids.filter((v) => v.ext_ref);
    else if (this.libView === "untagged") vids = vids.filter((v) => v.tags.length === 0);
    else if (this.libView === "tagged") vids = vids.filter((v) => v.tags.length > 0);
    if (this.tagFilter) vids = vids.filter((v) => v.tags.includes(this.tagFilter!));
    vids = [...vids];
    if (!this.sortDesc) vids.reverse();          // list arrives newest-first; reverse → oldest-first
    vids.sort((a, b) => Number(b.pinned) - Number(a.pinned)); // stable: pinned float to top
    const trapped = this.searchOpen || this.settingsOpen || this.cheatOpen || this.findReplaceOpen || this.tagMgrOpen;
    return html`
      <header class="appbar" ?data-tauri-drag-region=${this.settings.stripTitlebar}>
        <button class="ham" title="Toggle filters" aria-label="Toggle filters" @click=${() => this.toggleSidebar()}>${I.menu}</button>
        <button class="ham ${this.listOpen ? "" : "off"}" title="Toggle library list" aria-label="Toggle library" @click=${() => this.toggleList()}>${I.list}</button>
        <input id="url" type="text" placeholder="Paste a YouTube video or playlist link…" autocomplete="off"
          @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this.addFromInput()} />
        <button class="primary" @click=${() => this.addFromInput()}>Load</button>
        <button class="ghost" title="Search all notes" aria-label="Search all notes" @click=${() => this.openModal("search")}>${I.search}</button>
        <button class="ghost" title="Settings" aria-label="Settings" @click=${() => this.openModal("settings")}>${I.gear}</button>
        <span class="hdot ${this.phonemeOk ? "ok" : this.phonemePresent ? "warn" : ""}" title=${this.phonemeOk ? `Phoneme connected${this.phonemeVersion ? ` (${this.phonemeVersion})` : ""}` : this.phonemePresent ? "Phoneme installed — daemon not responding" : "Phoneme not detected"}></span>
      </header>

      <aside ?inert=${trapped}>
        <div class="section">
          <div class="sec-head-row">
            <button class="sec-head" @click=${() => this.toggleFold("lib")}>
              <span class="chev ${this.folds.lib ? "" : "open"}">${I.chev}</span> Library
            </button>
            <button class="sort-btn" title="Toggle sort order" @click=${() => (this.sortDesc = !this.sortDesc)}>${this.sortDesc ? "Newest" : "Oldest"}</button>
          </div>
          ${!this.folds.lib ? html`
            <button class="sidebar-item ${this.libView === "all" && !this.tagFilter ? "on" : ""}"
              @click=${() => { this.libView = "all"; this.tagFilter = null; this.plFilter = null; }}>
              <span class="si-icon">${I.film}</span><span class="si-label">All videos</span><span class="count">${this.videos.length}</span>
            </button>
            <button class="sidebar-item ${this.libView === "transcript" ? "on" : ""}"
              @click=${() => { this.libView = "transcript"; this.tagFilter = null; this.plFilter = null; }}>
              <span class="si-icon">${I.captions}</span><span class="si-label">With transcript</span><span class="count">${transcriptCount}</span>
            </button>` : nothing}
        </div>
        ${tags.length ? html`<div class="section">
          <div class="sec-head-row">
            <button class="sec-head" @click=${() => this.toggleFold("tags")}>
              <span class="chev ${this.folds.tags ? "" : "open"}">${I.chev}</span> Tags
            </button>
            <button class="sort-btn" title="Manage tags" aria-label="Manage tags" @click=${() => this.openModal("tagmgr")}>${I.gear}</button>
          </div>
          ${!this.folds.tags ? html`
            <button class="sidebar-item ${this.libView === "untagged" && !this.tagFilter ? "on" : ""}"
              @click=${() => { this.libView = "untagged"; this.tagFilter = null; this.plFilter = null; }}>
              <span class="si-icon">#</span><span class="si-label">Untagged</span>
              <span class="tag-dot tag-dot-none" title="Videos with no tags"></span>
              <span class="count">${untaggedCount}</span>
            </button>
            <button class="sidebar-item ${this.libView === "tagged" && !this.tagFilter ? "on" : ""}"
              @click=${() => { this.libView = "tagged"; this.tagFilter = null; this.plFilter = null; }}>
              <span class="si-icon tag-hash">#</span><span class="si-label">Tagged</span>
              <span class="tag-dot tag-dot-rainbow" title="Videos with at least one tag"></span>
              <span class="count">${taggedCount}</span>
            </button>
            ${tags.map((t) => html`
            <button class="sidebar-item ${this.tagFilter === t ? "on" : ""}"
              @click=${() => { this.plFilter = null; this.libView = "all"; this.tagFilter = this.tagFilter === t ? null : t; }}>
              <span class="si-icon tag-hash">#</span><span class="si-label">${t}</span>
              <span class="tag-dot" style="background:${this.dotColor(t)}"></span>
              <span class="count">${this.videos.filter((v) => v.tags.includes(t)).length}</span>
            </button>`)}` : nothing}
        </div>` : nothing}
        ${this.googleConnected && this.gplaylists.length ? html`<div class="section">
          <div class="sec-head-row">
            <button class="sec-head" @click=${() => this.toggleFold("pl")}>
              <span class="chev ${this.folds.pl ? "" : "open"}">${I.chev}</span> Playlists
            </button>
            <details class="menu pl-gear">
              <summary class="sort-btn" title="Show / hide playlists">${I.gear}</summary>
              <div class="menu-pop">
                ${this.gplaylists.map((p) => {
                  const hidden = this.settings.hiddenPlaylists.includes(p.id);
                  return html`<button class=${hidden ? "pl-hidden" : ""} title=${hidden ? "Hidden — click to show" : "Shown — click to hide"}
                    @click=${(e: Event) => { e.stopPropagation(); this.togglePlaylistHidden(p.id); }}>${hidden ? I.eyeOff : I.eye}<span class="grow">${p.title}</span></button>`;
                })}
              </div>
            </details>
          </div>
          ${!this.folds.pl ? this.gplaylists.filter((p) => !this.settings.hiddenPlaylists.includes(p.id)).map((p) => html`
            <button class="sidebar-item ${this.plFilter?.id === p.id ? "on" : ""}" title=${`Browse “${p.title}” (${p.count})`} @click=${() => this.openPlaylist(p)}>
              <span class="si-icon">${I.list}</span><span class="si-label">${p.title}</span><span class="count">${p.count}</span>
            </button>`) : nothing}
        </div>` : nothing}
      </aside>

      <section class="list" ?inert=${trapped}>
        <div class="lib">
          ${this.plFilter ? this.renderPlaylistBrowse() : vids.length ? vids.map((v) => {
            const sub = [v.channel, v.view_count != null ? formatViews(v.view_count) : "", v.published_at ? relativeDate(v.published_at) : ""].filter(Boolean);
            return html`
            <div class="libcard ${v.id === this.currentId ? "active" : ""} ${this.selected.has(v.id) ? "sel" : ""}" title="Shift-click to select" @click=${(e: MouseEvent) => (e.shiftKey ? this.toggleSelect(v.id) : this.toggleVideo(v.id, v.url))}>
              <div class="thumbwrap">
                <img class="thumb" loading="lazy" src=${`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                  @error=${(e: Event) => ((e.target as HTMLElement).style.visibility = "hidden")} />
                ${v.duration ? html`<span class="durbadge">${formatTime(v.duration)}</span>` : nothing}
              </div>
              <div class="meta">
                <div class="t" title=${v.title || v.id}>${v.title || v.id}</div>
                ${sub.length ? html`<div class="cmeta" title=${sub.join(" · ")}>${sub.join(" · ")}</div>` : nothing}
                <div class="c">${v.note_count} ${v.note_count === 1 ? "note" : "notes"}${v.ext_ref ? html` · <span class="pill tx">transcript</span>` : nothing}</div>
                ${v.tags.length ? html`<div class="ctags">${v.tags.map((t) => html`<span class="ctag" style="${this.chipStyle(t)}">${t}</span>`)}</div>` : nothing}
              </div>
              <div class="lc-actions">
                <button class="ghost pin ${v.pinned ? "on" : ""}" title=${v.pinned ? "Unpin" : "Pin to top"} @click=${(e: Event) => { e.stopPropagation(); this.togglePin(v.id, v.pinned); }}>${I.pin}</button>
                <button class="ghost rm" title="Remove" @click=${(e: Event) => { e.stopPropagation(); this.removeVideo(v.id); }}>${I.close}</button>
              </div>
            </div>`;
          }) : html`<div class="empty-lib">${this.videos.length
              ? html`No videos match this filter.<br /><button class="linkbtn" @click=${() => { this.tagFilter = null; this.libView = "all"; }}>Clear filters</button>`
              : "No videos yet — load one to start."}</div>`}
        </div>
      </section>

      <main class="detail" ?inert=${trapped}>
        ${this.current ? html`<div class="nowplaying">
          <div class="np-main">
            ${this.titleEditing
              ? html`<input class="np-title-edit" type="text" .value=${this.current.title || ""}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); this.saveTitle((e.target as HTMLInputElement).value); } else if (e.key === "Escape") { e.preventDefault(); this.titleEditing = false; } }}
                  @blur=${(e: Event) => this.saveTitle((e.target as HTMLInputElement).value)} />`
              : html`<div class="np-title" title="Click to rename" @click=${() => { this.titleEditing = true; this.updateComplete.then(() => (this.renderRoot.querySelector(".np-title-edit") as HTMLInputElement)?.select()); }}>${this.current.title || this.current.id}</div>`}
            <div class="np-meta">${this.current.channel || ""}${(this.dur || this.current.duration) ? html` · ${formatTime(this.dur || this.current.duration || 0)}` : nothing}</div>
          </div>
          <div class="np-actions">
            <button class="ghost" title="Fullscreen the video panel" aria-label="Fullscreen the video panel" @click=${() => this.toggleFocus()}>${I.expand}</button>
            <button class="ghost np-link" @click=${() => window.open(`https://www.youtube.com/watch?v=${this.current!.id}`, "_blank")}>Open on YouTube ↗</button>
          </div>
        </div>` : nothing}
        <div id="playerWrap" class=${this.currentId ? "" : "hidden"}>
          <div id="player"></div>
          ${this.currentId ? html`<button class="fs-btn" title="Fullscreen (F) — add notes without leaving" @click=${() => this.toggleFullscreen()}>${I.expand}</button>` : nothing}
          ${this.fsNote ? html`<div class="fs-note" @click=${(e: Event) => { if (e.target === e.currentTarget) this.fsCancel(); }}>
            <div class="fs-note-card">
              <div class="fs-note-head"><span class="ts">${formatTime(this.fsNote.t)}</span><span class="muted sm">Note at this moment</span></div>
              <textarea id="fsNoteInput" placeholder="Write a note… Markdown supported."
                @keydown=${(e: KeyboardEvent) => {
                  if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key.toLowerCase() === "s")) { e.preventDefault(); this.fsCommit((e.target as HTMLTextAreaElement).value); }
                  else if (e.key === "Escape") { e.preventDefault(); this.fsCancel(); }
                }}></textarea>
              <div class="fs-note-foot">
                <span class="muted sm">Ctrl+Enter to save · Esc to cancel</span>
                <span class="grow"></span>
                <button class="ghost" @click=${() => this.fsCancel()}>Cancel</button>
                <button class="primary" @click=${() => this.fsCommit((this.renderRoot.querySelector("#fsNoteInput") as HTMLTextAreaElement)?.value || "")}>Add note</button>
              </div>
            </div>
          </div>` : nothing}
        </div>
        <div id="timeline" class=${this.currentId ? "" : "hidden"} title="click to seek" @click=${(e: MouseEvent) => this.timelineClick(e)}>
          <div id="progress"></div>
          ${this.dur ? this.notes.map((n) => html`<div class="marker" style="left:${(n.t_secs / this.dur) * 100}%"
            title=${`${formatTime(n.t_secs)} — ${n.content}`}
            @click=${(e: Event) => { e.stopPropagation(); this.seek(n.t_secs); }}></div>`) : nothing}
        </div>

        ${this.current ? html`<div class="vtags">
          ${this.current.tags.map((t) => {
            const editing = this.editingTag === t;
            return html`
            <span class="chip tag tag-chip-wrap ${editing ? "editing" : ""}" style="${this.chipStyle(t)}">
              <span class="tag-chip-body" title="Click to rename or recolor" @click=${(e: Event) => this.startTagEdit(t, e)}>${t}</span>
              <button class="x" title="Remove tag" aria-label="Remove tag ${t}" @click=${(e: Event) => { e.stopPropagation(); this.removeTag(t); }}>×</button>
              ${editing ? html`
              <div class="tag-edit-pop" @click=${(e: Event) => e.stopPropagation()}
                @keydown=${(e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); this.cancelTagEdit(); } }}>
                <input class="tag-edit-name" type="text" .value=${this.editTagName} placeholder="Tag name"
                  @input=${(e: Event) => this.editTagName = (e.target as HTMLInputElement).value}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); this.renameTag(t, (e.target as HTMLInputElement).value); } }} />
                <div class="tag-swatches">
                  ${App.PALETTE.map((c) => html`<button class="tag-sw ${safeTagColor(this.tagColorOf(t)).toLowerCase() === c ? "sel" : ""}"
                    style="background:${c}" title=${c} @click=${() => this.setTagColor(t, c)}></button>`)}
                  <label class="tag-sw tag-sw-custom" title="Any color…">
                    <input type="color" .value=${safeTagColor(this.tagColorOf(t), DEFAULT_TAG_COLOR)}
                      @input=${(e: Event) => this.setTagColor(t, (e.target as HTMLInputElement).value)} /></label>
                </div>
                <div class="tag-edit-row">
                  <button class="tag-mgr-save" @click=${() => this.renameTag(t, this.editTagName)}>Save</button>
                  <button class="tag-mgr-cancel" @click=${() => this.cancelTagEdit()}>Cancel</button>
                </div>
              </div>` : nothing}
            </span>`;
          })}
          <input class="tag-add" type="text" placeholder="+ tag" aria-label="Add tag"
            @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") { this.addTag((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} />
        </div>` : nothing}

        <div class="toolbar ${this.currentId ? "" : "hidden"}">
          <div class="tabs">
            <button class="tab ${this.view === "notes" ? "on" : ""}" @click=${() => (this.view = "notes")}>Notes</button>
            <button class="tab ${this.view === "transcript" ? "on" : ""}" @click=${() => this.openTranscript()}>Transcript</button>
          </div>
          ${this.view === "notes" ? html`
            <button class="primary" @click=${() => this.capture()} ?disabled=${!this.currentId}>${I.plus} Add note <span class="kbd">Alt+N</span></button>
            <input type="text" placeholder="Filter notes…" .value=${this.filter}
              @input=${(e: Event) => (this.filter = (e.target as HTMLInputElement).value)} />
            ${this.current?.manual_order ? html`<button @click=${() => this.resetOrder()}>By time</button>` : nothing}
            <button class="ghost" title="Find & replace in notes" aria-label="Find and replace" ?disabled=${!this.notes.length} @click=${() => (this.findReplaceOpen = true)}>${I.replace}</button>
            ${this.notes.length ? html`<details class="menu">
              <summary class="ghost" title="Export notes">${I.download} Export ${I.caret}</summary>
              <div class="menu-pop">
                <button @click=${(ev: Event) => { this.closeMenu(ev); this.copyMd(); }}>${I.copy} Copy as Markdown</button>
                <button @click=${(ev: Event) => { this.closeMenu(ev); this.downloadMd(); }}>${I.download} Download .md</button>
                <button ?disabled=${!this.settings.vaultDir} title=${this.settings.vaultDir ? "" : "Set a vault folder in settings first"} @click=${(ev: Event) => { this.closeMenu(ev); this.saveToVault(); }}>${I.folder} Save to vault</button>
              </div>
            </details>` : nothing}
          ` : html`
            ${this.recId() ? html`<button class="ghost" title="Refresh from Phoneme" aria-label="Refresh from Phoneme" @click=${() => this.refreshPhoneme()}>${I.replace}</button>` : nothing}
          `}
          ${this.currentId ? html`<details class="menu">
            <summary class="ghost" title="Playback speed">${this.rate}× ${I.caret}</summary>
            <div class="menu-pop">
              ${[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => html`<button class=${s === this.rate ? "on" : ""} @click=${(ev: Event) => { this.closeMenu(ev); this.setSpeed(s); }}>${s}×</button>`)}
            </div>
          </details>` : nothing}
          <span class="grow"></span>
        </div>

        ${!this.currentId
          ? html`<div class="empty detail-empty"><h3>No video selected</h3><p>Pick a video from the list, or paste a YouTube link above it.</p></div>`
          : this.view === "notes"
          ? html`<div class="notes" role="list" aria-label="Notes for this video" @click=${(e: Event) => this.onNotesClick(e)}>
              ${filtered.length === 0 && !this.editing ? html`<div class="empty"><h3>${this.filter ? "No matching notes" : "No notes yet"}</h3><p>${this.filter ? "Try a different search." : html`Press <span class="kbd2">Alt&nbsp;+&nbsp;N</span> to capture a note at the current moment.`}</p></div>` : nothing}
              ${this.editing && !this.editing.id ? this.renderEditor() : nothing}
              ${filtered.map((n) => (this.editing?.id === n.id ? this.renderEditor() : this.renderNote(n)))}
            </div>`
          : this.renderTranscript()}
      </main>

      ${this.searchOpen ? this.renderSearch() : nothing}
      ${this.settingsOpen ? this.renderSettings() : nothing}
      ${this.cheatOpen ? this.renderCheat() : nothing}
      ${this.findReplaceOpen ? this.renderFindReplace() : nothing}
      ${this.tagMgrOpen ? this.renderTagManager() : nothing}
      ${this.selected.size ? html`<div class="bulkbar" style=${this.bulkPos
          ? `left:${this.bulkPos.x}px; top:${this.bulkPos.y}px;`
          : `left:50%; bottom:24px; transform:translateX(-50%);`}>
        <span class="bulk-grip" title="Drag to move" @mousedown=${(e: MouseEvent) => this.bulkDrag(e)}>⠿</span>
        <span class="bulk-count">${this.selected.size} selected</span>
        <div class="bulk-actions">
          <details class="menu up">
            <summary class="bulk-btn">🏷 Tag ${I.caret}</summary>
            <div class="menu-pop">
              ${tags.length ? tags.map((t) => html`<button @click=${(ev: Event) => { this.closeMenu(ev); this.bulkTag(t); }}><span class="bulk-menu-dot" style="background:${this.dotColor(t)}"></span>${t}</button>`) : nothing}
              <input class="bulk-newtag" type="text" placeholder="+ new tag…" @click=${(e: Event) => e.stopPropagation()}
                @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value; (e.target as HTMLInputElement).value = ""; this.closeMenu(e); this.bulkTag(v); } }} />
            </div>
          </details>
          <button class="bulk-btn bulk-btn--danger" @click=${() => this.bulkDelete()}>🗑 Delete</button>
          <button class="bulk-btn bulk-btn--muted" @click=${() => (this.selected = new Set())}>✕ Deselect</button>
        </div>
      </div>` : nothing}
      ${this.toasts.length ? html`<div class="toasts" role="status" aria-live="polite">
        ${this.toasts.map((t) => html`<div class="toast ${t.kind}"><span class="ti">${t.kind === "ok" ? "✓" : t.kind === "err" ? "✕" : "i"}</span><span>${t.msg}</span></div>`)}
      </div>` : nothing}
    `;
  }

  private renderEditor() {
    const e = this.editing!;
    return html`<div id="editor" class="note">
      <span class="ts">${formatTime(e.t)}</span>
      <div class="grow">
        <textarea placeholder="Write a note… Markdown supported." .value=${e.draft}
          @keydown=${(ev: KeyboardEvent) => {
            if ((ev.ctrlKey || ev.metaKey) && (ev.key === "Enter" || ev.key.toLowerCase() === "s")) { ev.preventDefault(); this.commit((ev.target as HTMLTextAreaElement).value); }
            else if (ev.key === "Escape") { ev.preventDefault(); this.cancel(); }
          }}></textarea>
        <div class="muted sm" style="margin-top:5px">Ctrl+Enter / Ctrl+S to save · Esc to cancel</div>
      </div>
    </div>`;
  }

  private renderNote(n: Note) {
    const canReorder = !this.filter;
    return html`<div class="note ${this.selectedId === n.id ? "selected" : ""}" role="listitem" @click=${() => (this.selectedId = n.id)}>
      <button class="ts" title="Jump to ${formatTime(n.t_secs)}" aria-label="Jump to ${formatTime(n.t_secs)}" @click=${() => this.seek(n.t_secs)}>${formatTime(n.t_secs)}</button>
      <div class="grow body">${unsafeHTML(renderMarkdown(n.content))}</div>
      <div class="acts">
        ${canReorder ? html`
          <button class="ghost" title="Move up" aria-label="Move up" @click=${() => this.move(n, -1)}>${I.up}</button>
          <button class="ghost" title="Move down" aria-label="Move down" @click=${() => this.move(n, 1)}>${I.down}</button>` : nothing}
        <button class="ghost" title="Copy timestamp link" aria-label="Copy timestamp link" @click=${() => this.copyLink(n)}>${I.link}</button>
        <button class="ghost" title="Edit" aria-label="Edit note" @click=${() => this.edit(n)}>${I.edit}</button>
        <button class="ghost" title="Delete" aria-label="Delete note" @click=${() => this.del(n.id)}>${I.trash}</button>
      </div>
    </div>`;
  }

  private renderSearch() {
    return html`<div class="overlay" @click=${() => this.closeModal()} @keydown=${(e: KeyboardEvent) => this.trapTab(e)}>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Search notes" @click=${(e: Event) => e.stopPropagation()}>
        <div class="sbar">${I.search}<input type="text" placeholder="Search all notes…"
          @input=${(e: Event) => this.runSearch((e.target as HTMLInputElement).value)} /></div>
        <div class="results">
          ${this.searchResults.map((h) => html`<button class="hit" @click=${() => this.openHit(h)}>
            <span class="ts">${formatTime(h.t_secs)}</span>
            <span class="grow"><span class="htitle">${h.video_title || h.video_id}</span> — ${h.content}</span>
          </button>`)}
          ${this.phonemeHits.length ? html`<div class="src-label">From Phoneme</div>
            ${this.phonemeHits.map((h) => html`<button class="hit" @click=${() => this.openPhonemeHit(h)}>
              <span class="grow"><span class="htitle">${h.title || h.id}</span>${h.snippet ? html` — ${h.snippet}` : nothing}</span>
            </button>`)}` : nothing}
          ${this.searchResults.length === 0 && this.phonemeHits.length === 0 ? html`<div class="muted sm" style="padding:8px">No matches.</div>` : nothing}
        </div>
      </div>
    </div>`;
  }

  private renderTagManager() {
    const tags = this.allTags();
    return html`<div class="overlay" @click=${() => this.closeModal()} @keydown=${(e: KeyboardEvent) => this.trapTab(e)}>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Tag manager" @click=${(e: Event) => e.stopPropagation()}>
        <div class="panel-head"><span>Tag manager</span>
          <button class="ghost" title="Close" @click=${() => this.closeModal()}>${I.close}</button></div>
        <div class="tag-mgr-bar">
          <div class="help muted sm">Rename and recolor your tags. Changes are local; colors mirror from Phoneme, the catalog authority (delete and merge live there).</div>
          ${this.settings.syncTags ? html`<button class="btn" title=${this.phonemeOk ? "Pull + push tags for every video sent to Phoneme" : "Phoneme isn't running"}
            ?disabled=${!this.phonemeOk || this.tagSyncing} @click=${() => this.syncAllTags()}>
            ${this.tagSyncing ? html`<span class="spin"></span> Syncing…` : html`${I.gear} Sync all`}</button>` : nothing}
        </div>
        ${tags.length ? html`<div class="tag-mgr-list">
          ${tags.map((t) => {
            const uses = this.videos.filter((v) => v.tags.includes(t)).length;
            return html`<div class="tag-mgr-row">
              <label class="tag-mgr-swatch" title="Recolor" style="background:${this.dotColor(t)}">
                <input type="color" .value=${safeTagColor(this.tagColorOf(t), DEFAULT_TAG_COLOR)}
                  @input=${(e: Event) => this.setTagColor(t, (e.target as HTMLInputElement).value)} /></label>
              <input class="tag-mgr-name" type="text" .value=${t} aria-label="Rename ${t}"
                @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                @change=${(e: Event) => this.renameTag(t, (e.target as HTMLInputElement).value)} />
              ${uses
                ? html`<span class="tag-mgr-badge in-use" title="Attached to ${uses} video${uses === 1 ? "" : "s"}">${uses} use${uses === 1 ? "" : "s"}</span>`
                : html`<span class="tag-mgr-badge orphaned" title="Not on any video">unused</span>`}
            </div>`;
          })}
        </div>` : html`<div class="muted sm" style="padding:14px 0;text-align:center">No tags yet. Add tags from a video's detail panel.</div>`}
      </div>
    </div>`;
  }
  private renderSettings() {
    return html`<div class="overlay" @click=${() => this.closeModal()} @keydown=${(e: KeyboardEvent) => this.trapTab(e)}>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Settings" @click=${(e: Event) => e.stopPropagation()}>
        <div class="panel-head"><span>Settings</span>
          <button class="ghost" title="Close" @click=${() => this.closeModal()}>${I.close}</button></div>
        <section class="settings-section">
          <h3>Appearance</h3>
          <label class="field"><span>Theme</span>
            <select @change=${(e: Event) => this.setSetting("theme", (e.target as HTMLSelectElement).value)}>
              <optgroup label="Dark">
                ${THEMES.filter((t) => !LIGHT_THEMES.has(t)).map((t) => html`<option value=${t} ?selected=${t === this.settings.theme}>${themeLabel(t)}</option>`)}
              </optgroup>
              <optgroup label="Light">
                ${THEMES.filter((t) => LIGHT_THEMES.has(t)).map((t) => html`<option value=${t} ?selected=${t === this.settings.theme}>${themeLabel(t)}</option>`)}
              </optgroup>
            </select></label>
          <label class="field"><span>Strip system title bar</span>
            <input type="checkbox" .checked=${this.settings.stripTitlebar}
              @change=${(e: Event) => this.setSetting("stripTitlebar", (e.target as HTMLInputElement).checked)} /></label>
          <div class="help muted sm">Borderless, clean window with no OS title bar or window buttons — for tiling / keyboard window managers. Use your OS shortcuts to move and close. On Windows, turning this back off may need a restart.</div>
        </section>
        <section class="settings-section">
          <h3>Capture</h3>
          <label class="field"><span>Auto-pause when adding a note</span>
            <input type="checkbox" .checked=${this.settings.autopause}
              @change=${(e: Event) => this.setSetting("autopause", (e.target as HTMLInputElement).checked)} /></label>
          <label class="field"><span>Capture offset (seconds)</span>
            <input type="number" min="0" max="30" .value=${String(this.settings.offset)}
              @input=${(e: Event) => this.setSetting("offset", Math.max(0, +(e.target as HTMLInputElement).value || 0))} /></label>
          <div class="help muted sm">A note’s timestamp lands this many seconds before your keypress, so you don’t miss the moment.</div>
        </section>
        <section class="settings-section">
          <h3>Storage &amp; backup</h3>
          <div class="field col"><span>Vault folder</span>
            <div class="row2">
              <input class="grow" type="text" placeholder="C:\\Users\\you\\Vault" .value=${this.settings.vaultDir}
                @input=${(e: Event) => this.setSetting("vaultDir", (e.target as HTMLInputElement).value)} />
              <button @click=${() => this.browseVault()}>Browse…</button>
              <button ?disabled=${!this.settings.vaultDir} @click=${() => this.openVault()}>Open</button>
            </div></div>
          <div class="help muted sm">Where “Save to vault” writes Markdown — e.g. an Obsidian vault.</div>
          <div class="field col"><span>Library backup</span>
            <div class="row2">
              <button class="grow" @click=${() => this.exportJson()}>Export JSON</button>
              <label class="btn grow" style="justify-content:center">Import JSON
                <input type="file" accept="application/json" hidden @change=${(e: Event) => this.importJson(e)} /></label>
            </div></div>
        </section>
        <section class="settings-section">
          <h3>Phoneme</h3>
          <label class="field col"><span>Phoneme CLI path</span>
            <input type="text" placeholder="auto-detect — or e.g. C:\\…\\phoneme.exe" .value=${this.settings.phonemeBin}
              @input=${(e: Event) => this.setSetting("phonemeBin", (e.target as HTMLInputElement).value)} /></label>
          <div class="help muted sm">Leave blank to auto-detect (PATH, then a local build). Point it at a stable release build so transcription keeps working while you rebuild Phoneme.</div>
          <label class="field"><span>Sync tags with Phoneme</span>
            <input type="checkbox" .checked=${this.settings.syncTags}
              @change=${(e: Event) => this.setSetting("syncTags", (e.target as HTMLInputElement).checked)} /></label>
          <div class="help muted sm">Two-way for videos you've sent to Phoneme: tagging here attaches the tag there, and tags added in Phoneme appear here. Edits made while Phoneme is closed sync the next time it's running.</div>
        </section>
        <section class="settings-section">
          <h3>YouTube account</h3>
          ${this.googleConnected ? html`
            <div class="field"><span>Connected</span>
              <button class="danger" @click=${() => this.googleDisconnect()}>Disconnect</button></div>
            <div class="help muted sm">Your playlists show in the sidebar — click one to import its videos. Watch Later &amp; History aren’t available through YouTube’s API.</div>
          ` : html`
            <div class="field"><span>Link account</span>
              <button class="primary" @click=${() => this.googleConnect()}>Connect YouTube</button></div>
            <div class="help muted sm">${this.googleHasDefault
              ? html`Uses the app’s built-in YouTube access — sign-in opens in your browser. Watch Later/History aren’t available via the API.`
              : html`No built-in client in this build — add your own below. Watch Later/History aren’t available via the API.`}</div>
            <details class="adv">
              <summary>Use my own Google client (advanced)</summary>
              <label class="field col"><span>Client ID</span>
                <input type="text" placeholder="xxxxx.apps.googleusercontent.com" .value=${this.settings.gClientId}
                  @input=${(e: Event) => this.setSetting("gClientId", (e.target as HTMLInputElement).value)} /></label>
              <label class="field col"><span>Client secret</span>
                <input type="password" placeholder="GOCSPX-…" .value=${this.settings.gClientSecret}
                  @input=${(e: Event) => this.setSetting("gClientSecret", (e.target as HTMLInputElement).value)} /></label>
              <div class="help muted sm">Create a Google Cloud OAuth <b>Desktop app</b> client + enable <b>YouTube Data API v3</b>. Overrides the built-in client; stored only on this device.</div>
            </details>
          `}
        </section>
        <section class="settings-section">
          <h3>Updates</h3>
          <div class="field"><span>App updates</span>
            <button @click=${() => this.checkUpdates()}>Check for updates</button></div>
        </section>
        <div class="hint muted sm">Press <b>?</b> for keyboard shortcuts.</div>
      </div>
    </div>`;
  }

  /** Loud inline notice when Phoneme is present but too old to trust its output. */
  private renderCompatNotice() {
    if (!this.phonemePresent || this.phonemeCompatible) return nothing;
    return html`<div class="compat-warn">⚠ Phoneme ${this.phonemeVersion || "(unknown version)"} looks older than this app expects — transcript panels may be empty or wrong. Please update Phoneme.</div>`;
  }
  private renderTranscript() {
    if (!this.currentId) return html`<div class="notes"><div class="empty">Load a video first.</div></div>`;
    const rec = this.recId();
    // Not linked to Phoneme yet — offer to transcribe (or YouTube captions).
    if (!rec) {
      return html`<div class="notes"><div class="empty src">
        ${this.renderCompatNotice()}
        ${this.phonemeOk
          ? html`<button class="primary" @click=${() => this.sendToPhoneme()} ?disabled=${this.transcriptBusy}>Transcribe with Phoneme</button>`
          : nothing}
        <button @click=${() => this.loadCaptions()} ?disabled=${this.transcriptBusy}>Load YouTube captions</button>
        <div class="muted sm">${this.transcriptBusy ? "Working…"
          : this.phonemeOk
            ? "Phoneme transcribes the audio and gives cleaned text, side-by-side pipeline versions, a summary, entities and tasks."
            : this.phonemePresent
              ? "Phoneme is installed but its daemon isn't responding — start it (or check it) to transcribe. Captions are best-effort meanwhile."
              : "Phoneme not detected — captions are best-effort. Install Phoneme for full transcripts, summaries and more."}</div>
      </div></div>`;
    }
    // Linked but not finished — show the live pipeline stage.
    const st = this.phonemeRec?.status ?? "";
    const terminal = /^(done|.*_failed|cancelled)$/.test(st);
    if (!st || !terminal) {
      return html`<div class="notes"><div class="empty src">
        <div class="pl-stage">${st && st !== "done" ? html`<span class="spin"></span>` : nothing} ${st ? this.stageLabel(st) : "Checking Phoneme…"}</div>
        <button @click=${() => this.refreshPhoneme()}>Refresh</button>
        <button @click=${() => this.loadCaptions()}>YouTube captions meanwhile</button>
      </div></div>`;
    }
    // Done — Transcript / Compare / Summary views.
    return html`<div class="notes tpane">
      ${this.renderCompatNotice()}
      <div class="tview-tabs">
        <button class="tab ${this.transcriptView === "transcript" ? "on" : ""}" @click=${() => (this.transcriptView = "transcript")}>Transcript</button>
        ${this.chapters.length ? html`<button class="tab ${this.transcriptView === "chapters" ? "on" : ""}" @click=${() => (this.transcriptView = "chapters")}>Chapters (${this.chapters.length})</button>` : nothing}
        <button class="tab ${this.transcriptView === "compare" ? "on" : ""}" @click=${() => (this.transcriptView = "compare")}>Compare${this.phonemeVersions.length > 1 ? ` (${this.phonemeVersions.length})` : ""}</button>
        <button class="tab ${this.transcriptView === "summary" ? "on" : ""}" @click=${() => (this.transcriptView = "summary")}>Summary</button>
      </div>
      ${this.transcriptView === "summary" ? this.renderSummary()
        : this.transcriptView === "chapters" ? this.renderChapters()
        : this.transcriptView === "compare" ? this.renderCompare()
        : this.renderSegments()}
    </div>`;
  }
  private renderSegments() {
    if (!this.segments.length) {
      const t = this.phonemeVersions[this.phonemeVersions.length - 1]?.text;
      return t ? html`<div class="tflow">${t}</div>` : html`<div class="empty">No transcript text yet.</div>`;
    }
    return html`<div class="transcript">
      ${this.segments.map((s) => html`<button class="seg" @click=${() => this.seek(s.start_ms / 1000)}>
        <span class="ts">${formatTime(s.start_ms / 1000)}</span><span class="grow">${s.speaker ? html`<b class="spk">${s.speaker}</b> ` : nothing}${s.text}</span></button>`)}
    </div>`;
  }
  private renderChapters() {
    if (!this.chapters.length) return html`<div class="empty">No chapters for this recording.</div>`;
    return html`<div class="chapters">
      ${this.chapters.map((c) => html`<button class="chap" @click=${() => this.seek(c.start_ms / 1000)}>
        <span class="ts">${formatTime(c.start_ms / 1000)}</span>
        <span class="grow"><span class="chap-title">${c.title}</span>${c.summary ? html`<span class="chap-sum">${c.summary}</span>` : nothing}</span>
      </button>`)}
    </div>`;
  }
  private renderCompare() {
    const vs = this.phonemeVersions;
    if (vs.length < 1) return html`<div class="empty">${this.versionsError
      ? this.versionsError
      : "No alternate versions — this recording ran a plain transcribe with no extra pipeline steps."}</div>`;
    const picker = (val: number, on: (i: number) => void) => html`<select @change=${(e: Event) => on(+(e.target as HTMLSelectElement).value)}>
      ${vs.map((v, i) => html`<option value=${i} ?selected=${i === val}>${v.label}${v.model ? ` · ${v.model}` : ""}</option>`)}
    </select>`;
    return html`<div class="cmp">
      <div class="cmp-col"><div class="cmp-head">${picker(this.cmpLeft, (i) => (this.cmpLeft = i))}</div><div class="cmp-text">${vs[this.cmpLeft]?.text}</div></div>
      <div class="cmp-col"><div class="cmp-head">${picker(this.cmpRight, (i) => (this.cmpRight = i))}</div><div class="cmp-text">${vs[this.cmpRight]?.text}</div></div>
    </div>`;
  }
  private renderSummary() {
    const r = this.phonemeRec;
    if (!r) return html`<div class="empty">No data.</div>`;
    const meta = [r.model && `model ${r.model}`, r.language && `lang ${r.language}`, r.confidence != null ? `conf ${Math.round(r.confidence * 100)}%` : ""].filter(Boolean).join(" · ");
    return html`<div class="sumpane">
      ${r.summary ? html`<div class="sblock"><h4>Summary</h4><p>${r.summary}</p></div>` : html`<div class="muted sm">No summary generated.</div>`}
      ${r.entities.length ? html`<div class="sblock"><h4>Entities</h4><div class="ents">${r.entities.map((e) => html`<span class="ent" title=${e.kind}>${e.value}</span>`)}</div></div>` : nothing}
      ${r.tasks.length ? html`<div class="sblock"><h4>Tasks</h4><ul class="tasks">${r.tasks.map((t) => html`<li class=${t.done ? "done" : ""}>${t.text}</li>`)}</ul></div>` : nothing}
      ${meta ? html`<div class="muted sm smeta">${meta}</div>` : nothing}
    </div>`;
  }

  private renderPlaylistBrowse() {
    if (this.plLoading) return html`<div class="empty-lib">Loading “${this.plFilter?.title}”…</div>`;
    return html`
      <div class="pl-head">
        <span class="si-label" title=${this.plFilter?.title ?? ""}>${this.plFilter?.title}</span>
        <button class="linkbtn" @click=${() => { this.plFilter = null; this.plItems = []; }}>Close</button>
      </div>
      ${this.plItems.length ? this.plItems.map((it) => html`
        <div class="plcard ${it.video_id === this.currentId ? "active" : ""}" @click=${() => this.loadVideo(it.video_id)}>
          <img class="thumb" loading="lazy" src=${`https://i.ytimg.com/vi/${it.video_id}/mqdefault.jpg`}
            @error=${(e: Event) => ((e.target as HTMLElement).style.visibility = "hidden")} />
          <div class="meta"><div class="t" title=${it.title}>${it.title}</div></div>
          <button class="pl-toggle ${it.in_library ? "in" : ""}" title=${it.in_library ? "In your library — click to remove from library" : "Add to library"}
            @click=${(e: Event) => { e.stopPropagation(); this.togglePlItem(it); }}>${it.in_library ? I.check : I.plus}</button>
          <button class="pl-remove" title=${`Remove from “${this.plFilter?.title ?? "playlist"}” (keeps it in your library)`}
            @click=${(e: Event) => { e.stopPropagation(); this.removeFromPlaylist(it); }}>${I.close}</button>
        </div>`) : html`<div class="empty-lib">This playlist is empty or unavailable.</div>`}
    `;
  }

  private renderFindReplace() {
    return html`<div class="overlay" @click=${() => (this.findReplaceOpen = false)} @keydown=${(e: KeyboardEvent) => this.trapTab(e)}>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Find and replace" @click=${(e: Event) => e.stopPropagation()}>
        <div class="panel-head"><span>Find &amp; replace in notes</span>
          <button class="ghost" title="Close" @click=${() => (this.findReplaceOpen = false)}>${I.close}</button></div>
        <label class="field col"><span>Find</span><input id="fr-find" type="text" placeholder="text to find" /></label>
        <label class="field col"><span>Replace with</span><input id="fr-repl" type="text" placeholder="replacement (blank to delete)" /></label>
        <div class="row2"><span class="grow"></span>
          <button class="primary" @click=${() => this.runReplace(
            (this.renderRoot.querySelector("#fr-find") as HTMLInputElement)?.value || "",
            (this.renderRoot.querySelector("#fr-repl") as HTMLInputElement)?.value || "",
          )}>Replace all</button></div>
        <div class="muted sm">Literal replace across this video’s notes.</div>
      </div>
    </div>`;
  }

  private renderCheat() {
    const rows: [string, string][] = [
      ["Alt+N", "Add note at the current moment"],
      ["Space / K", "Play / pause"],
      ["J / L", "Back / forward 10s"],
      ["← / →", "Back / forward 5s  (Shift = 30s)"],
      ["+ / −", "Playback speed up / down"],
      ["M / F", "Mute / fullscreen"],
      ["Ctrl+B", "Toggle sidebar"],
      ["Shift+click", "Select videos (bulk)"],
      ["0–9", "Seek to 0–90%"],
      ["↑ / ↓", "Select previous / next note"],
      ["Enter / Delete", "Edit / delete selected note"],
      ["/", "Search all notes"],
      ["?", "Keyboard shortcuts (this)"],
      ["Esc", "Close dialog / cancel"],
    ];
    return html`<div class="overlay" @click=${() => (this.cheatOpen = false)} @keydown=${(e: KeyboardEvent) => this.trapTab(e)}>
      <div class="panel" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" @click=${(e: Event) => e.stopPropagation()}>
        <div class="panel-head"><span>Keyboard shortcuts</span>
          <button class="ghost" title="Close" @click=${() => (this.cheatOpen = false)}>${I.close}</button></div>
        <div class="cheat">
          ${rows.map(([k, d]) => html`<div class="cheat-row"><kbd>${k}</kbd><span>${d}</span></div>`)}
        </div>
      </div>
    </div>`;
  }

  static styles = css`
    :host {
      --r:10px; --r-sm:8px;
      --tint: color-mix(in srgb, var(--accent) 15%, transparent);
      --hover: color-mix(in srgb, var(--fg-default) 8%, transparent);
      --ui-motion: 200ms; --ui-motion-fast: 120ms;
      display:grid; grid-template-columns:220px 340px 1fr; grid-template-rows:44px minmax(0,1fr);
      height:100vh; background:var(--bg-deep); color:var(--fg-default);
      font:13.5px/1.55 "Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
      -webkit-font-smoothing:antialiased;
    }
    :host([collapsed]) { grid-template-columns:0 340px 1fr; }
    :host([nolist]) { grid-template-columns:220px 0 1fr; }
    :host([collapsed][nolist]) { grid-template-columns:0 0 1fr; }
    .hidden { display:none !important; }
    .tb-left { display:flex; align-items:center; }
    @media (prefers-reduced-motion: reduce) { :host { --ui-motion: 0ms; --ui-motion-fast: 0ms; } }
    * { box-sizing:border-box; }
    ::selection { background:var(--tint); }
    *::-webkit-scrollbar { width:10px; height:10px; }
    *::-webkit-scrollbar-thumb { background:var(--border-subtle); border-radius:8px; border:2px solid transparent; background-clip:content-box; }
    *::-webkit-scrollbar-thumb:hover { background:var(--border); background-clip:content-box; }
    .i { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; flex:0 0 auto; }
    .muted { color:var(--fg-muted); } .sm { font-size:12px; } .grow { flex:1; min-width:0; }

    .titlebar { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between;
      background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); user-select:none; }
    .tb-title { display:flex; align-items:center; gap:8px; padding-left:12px; font-size:12.5px; font-weight:600; }
    .tb-title .dot { width:9px; height:9px; border-radius:999px; background:var(--fg-faded); transition:background var(--ui-motion-fast); }
    .tb-title .dot.ok { background:var(--ok); box-shadow:0 0 8px color-mix(in srgb, var(--ok) 70%, transparent); }
    .tb-controls { display:flex; align-self:stretch; }
    .tb-btn { width:46px; border:none; border-radius:0; background:transparent; color:var(--fg-muted); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
    .tb-btn:hover { background:var(--hover); color:var(--fg-default); }
    .tb-btn.close:hover { background:var(--err); color:var(--bg-deep); }

    aside { grid-column:1; grid-row:2; background:var(--bg-surface); border-right:1px solid var(--border-subtle); display:flex; flex-direction:column; min-width:0; min-height:0; overflow-x:hidden; overflow-y:auto; padding-top:6px; }
    .list { grid-column:2; grid-row:2; display:flex; flex-direction:column; min-width:0; min-height:0; overflow:hidden; background:var(--bg-deep); border-right:1px solid var(--border-subtle); }
    :host([collapsed]) aside { border-right:none; }
    :host([nolist]) .list { border-right:none; }
    .appbar { grid-column:1/-1; grid-row:1; padding:0 12px; background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); }
    .appbar .ham.off { opacity:.45; }
    .label { font-size:10.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--fg-faded); padding:14px 16px 6px; }
    .lib { flex:1; min-height:0; overflow:auto; padding:6px 8px 8px; display:flex; flex-direction:column; gap:2px; }
    .detail-empty { color:var(--fg-muted); }
    .libcard { display:flex; gap:9px; align-items:flex-start; padding:6px; border-radius:var(--r-sm); cursor:pointer; position:relative; transition:background .12s; }
    .libcard:hover { background:var(--hover); }
    .libcard.active { background:var(--tint); box-shadow:inset 3px 0 0 var(--accent); }
    .libcard .thumbwrap { position:relative; flex:0 0 auto; }
    .libcard .thumb { width:88px; height:50px; border-radius:5px; object-fit:cover; background:#000; display:block; }
    .libcard .durbadge { position:absolute; bottom:3px; right:3px; background:rgba(0,0,0,.82); color:#fff; font-size:9.5px; line-height:14px; padding:0 4px; border-radius:3px; font-variant-numeric:tabular-nums; pointer-events:none; }
    .libcard .meta { min-width:0; flex:1; }
    .libcard .cmeta { font-size:10.5px; color:var(--fg-faded); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .libcard .t { font-size:12.5px; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .libcard .c { font-size:11px; color:var(--fg-faded); margin-top:1px; }
    .libcard .tx { color:var(--accent); }
    .ctags { display:flex; flex-wrap:wrap; gap:3px; margin-top:3px; }
    .ctag { font-size:9.5px; padding:1px 6px; border-radius:999px; background:var(--tag-color, var(--bg-deep)); color:var(--fg-muted); }
    .lc-actions { flex:0 0 auto; align-self:flex-start; display:flex; flex-direction:column; gap:2px; opacity:.5; transition:opacity .12s; }
    .libcard:hover .lc-actions, .libcard.active .lc-actions { opacity:1; }
    .libcard .lc-actions .ghost { padding:3px; }
    .libcard .lc-actions .ghost:hover { background:var(--hover); }
    .libcard .rm:hover { color:var(--err); background:color-mix(in srgb, var(--err) 14%, transparent); }
    .libcard .pin.on { opacity:1; color:var(--accent); }
    .libcard.sel { background:var(--tint); box-shadow:inset 3px 0 0 var(--accent); }
    .bulkbar { position:fixed; z-index:60; display:flex; align-items:center; gap:8px; padding:8px 10px 8px 6px; max-width:calc(100vw - 32px); flex-wrap:wrap;
      background:color-mix(in srgb, var(--bg-elevated) 96%, transparent); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
      border:var(--popup-border, 1px solid var(--border)); border-radius:12px; box-shadow:0 16px 44px rgba(0,0,0,.5); animation:bulk-in var(--ui-motion) ease-out; }
    @keyframes bulk-in { from { opacity:0; } to { opacity:1; } }
    .bulk-grip { cursor:move; color:var(--fg-faded); font-size:15px; line-height:1; padding:4px 3px; user-select:none; letter-spacing:-2px; flex:0 0 auto; }
    .bulk-grip:hover { color:var(--accent); }
    .bulk-count { font-size:12px; font-weight:600; color:var(--accent); white-space:nowrap; letter-spacing:.02em; }
    .bulk-actions { display:flex; gap:6px; align-items:center; }
    .bulk-btn { transition:all var(--ui-motion-fast) ease-out; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:6px; padding:5px 12px; font-size:12px; font-weight:500; color:var(--fg-default); cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:5px; }
    .bulk-btn:hover { border-color:var(--accent); color:var(--accent); transform:translateY(-1px); box-shadow:0 2px 8px rgba(0,0,0,.2); }
    .bulk-btn--danger { color:var(--err); border-color:color-mix(in srgb, var(--err) 30%, transparent); }
    .bulk-btn--danger:hover { background:color-mix(in srgb, var(--err) 10%, transparent); border-color:var(--err); color:var(--err); }
    .bulk-btn--muted { color:var(--fg-muted); }
    .bulk-btn--muted:hover { color:var(--fg-default); border-color:var(--border); }
    .menu.up .menu-pop { top:auto; bottom:calc(100% + 6px); left:0; right:auto; }
    .bulk-menu-dot { width:8px; height:8px; border-radius:50%; background:var(--accent); flex:0 0 auto; }
    .bulk-newtag { margin-top:2px; width:100%; padding:6px 9px; font-size:12px; }
    .danger { background:var(--err); color:var(--bg-deep); border-color:var(--err); }
    .danger:hover { background:color-mix(in srgb, var(--err), black 12%); border-color:color-mix(in srgb, var(--err), black 12%); }
    .pill { padding:1px 7px; border-radius:999px; background:var(--tint); color:var(--accent); font-size:9.5px; }
    .empty-lib { color:var(--fg-faded); font-size:12px; padding:6px 16px; }
    .pl-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:4px 8px 6px; }
    .pl-head .si-label { font-size:12px; color:var(--fg-muted); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .plcard { display:flex; gap:9px; align-items:center; padding:6px; border-radius:var(--r-sm); cursor:pointer; transition:background .12s; }
    .plcard:hover { background:var(--hover); }
    .plcard.active { background:var(--tint); box-shadow:inset 3px 0 0 var(--accent); }
    .plcard .thumb { width:58px; height:33px; border-radius:5px; object-fit:cover; background:#000; flex:0 0 auto; }
    .plcard .meta { min-width:0; flex:1; }
    .plcard .t { font-size:12.5px; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .pl-toggle { flex:0 0 auto; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid var(--border); background:var(--bg-elevated); color:var(--fg-muted); cursor:pointer; }
    .pl-toggle:hover { border-color:var(--accent); color:var(--accent); }
    .pl-toggle.in { background:var(--accent); border-color:var(--accent); color:var(--accent-fg); }
    .pl-toggle.in:hover { background:color-mix(in srgb, var(--accent), black 10%); color:var(--accent-fg); }
    .pl-remove { flex:0 0 auto; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid transparent; background:none; color:var(--fg-faded); cursor:pointer; }
    .pl-remove:hover { color:var(--err); background:color-mix(in srgb, var(--err) 14%, transparent); }
    .section { border-bottom:1px solid var(--border-subtle); padding:2px 8px 6px; }
    .sec-head { width:100%; display:flex; align-items:center; gap:6px; background:none; border:none; padding:8px 8px 4px; font-size:10.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--fg-faded); cursor:pointer; }
    .sec-head:hover { background:none; color:var(--fg-muted); }
    .sec-head-row { display:flex; align-items:center; }
    .sec-head-row .sec-head { flex:1; }
    .sort-btn { background:none; border:none; color:var(--fg-faded); font-size:10px; text-transform:uppercase; letter-spacing:.06em; cursor:pointer; padding:8px 8px 4px; white-space:nowrap; }
    .sort-btn:hover { color:var(--accent); background:none; }
    .pl-gear > summary { list-style:none; display:inline-flex; cursor:pointer; }
    .pl-gear > summary::-webkit-details-marker { display:none; }
    .menu-pop button.pl-hidden { color:var(--fg-faded); }
    .chev { display:inline-flex; transition:transform var(--ui-motion-fast); }
    .chev .i { width:13px; height:13px; }
    .chev.open { transform:rotate(90deg); }
    .sidebar-item { width:100%; display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:var(--r-sm); background:none; border:1px solid transparent; color:var(--fg-muted); cursor:pointer; font-size:12.5px; transition:background var(--ui-motion-fast), color var(--ui-motion-fast); }
    .sidebar-item:hover { background:var(--hover); color:var(--fg-default); }
    .sidebar-item.on { background:var(--tint); color:var(--accent); font-weight:500; }
    .sidebar-item .si-icon { flex:0 0 auto; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; color:var(--fg-faded); }
    .sidebar-item .si-icon .i { width:15px; height:15px; }
    .sidebar-item .si-icon.tag-hash { color:var(--accent); font-size:14px; font-weight:700; }
    .sidebar-item.on .si-icon, .sidebar-item:hover .si-icon { color:var(--accent); }
    .sidebar-item .si-label { flex:0 1 auto; min-width:0; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sidebar-item .count { margin-left:auto; flex:0 0 auto; min-width:20px; padding:1px 7px; border-radius:999px; text-align:center; font-size:11px; line-height:15px; font-variant-numeric:tabular-nums; color:var(--fg-faded); background:color-mix(in srgb, var(--fg-faded) 10%, transparent); }
    .sidebar-item.on .count, .sidebar-item:hover .count { color:color-mix(in srgb, var(--accent) 75%, var(--fg-default)); background:color-mix(in srgb, var(--accent) 16%, transparent); }
    .sidebar-item .dot { width:8px; height:8px; border-radius:999px; background:var(--accent); opacity:.85; flex:0 0 auto; }
    .sidebar-item .tag-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; margin-right:6px; }
    .sidebar-item .tag-dot-none { background:var(--fg-faded); opacity:.45; }
    .sidebar-item .tag-dot-rainbow { background:conic-gradient(from 0deg, #ff5d5d, #ffae4a, #ffe24a, #5dd85d, #4ab6ff, #8a7bff, #ff6ad5, #ff5d5d); }
    .tagbar { display:flex; flex-wrap:wrap; gap:5px; padding:0 12px 8px; }
    .chip { font:inherit; font-size:11.5px; padding:3px 9px; border-radius:999px; cursor:pointer; background:var(--bg-elevated);
      border:1px solid var(--border); color:var(--fg-muted); display:inline-flex; align-items:center; gap:5px; transition:color .12s, border-color .12s; }
    .chip:hover { color:var(--fg-default); }
    .chip.on { background:var(--tint); border-color:var(--accent); color:var(--accent); }
    .vtags { display:flex; flex-wrap:wrap; gap:6px; align-items:center; justify-content:flex-end; margin-top:-4px; }
    .chip.tag { color:var(--fg-default); cursor:default; background:var(--tag-color, rgba(203,166,247,0.12)); }
    .tag-chip-wrap { position:relative; }
    .tag-chip-body { cursor:pointer; }
    .chip.tag.editing { outline:1px solid color-mix(in srgb, var(--fg-default) 35%, transparent); }
    /* Chip rename/recolor popover — anchored to the right edge (vtags are right-aligned). */
    .tag-edit-pop { position:absolute; top:calc(100% + 6px); right:0; z-index:70; width:212px;
      display:flex; flex-direction:column; gap:8px; padding:10px; cursor:default;
      background:var(--bg-elevated); border:var(--popup-border, 1px solid var(--border-subtle));
      border-radius:10px; box-shadow:0 12px 34px rgba(0,0,0,.5); }
    .tag-edit-name { width:100%; padding:6px 9px; border-radius:7px; font-size:12.5px;
      background:var(--bg-surface); border:1px solid var(--border-subtle); color:var(--fg-default); }
    .tag-edit-name:focus { outline:none; border-color:var(--accent); }
    .tag-swatches { display:grid; grid-template-columns:repeat(8, 1fr); gap:5px; }
    .tag-sw { width:20px; height:20px; padding:0; border-radius:50%; cursor:pointer; position:relative;
      border:1px solid color-mix(in srgb, var(--fg-default) 20%, transparent); }
    .tag-sw:hover { transform:scale(1.12); }
    .tag-sw.sel { outline:2px solid var(--fg-default); outline-offset:1px; }
    .tag-sw-custom { overflow:hidden; background:conic-gradient(from 0deg, #ff5d5d, #ffae4a, #ffe24a, #5dd85d, #4ab6ff, #8a7bff, #ff6ad5, #ff5d5d); }
    .tag-sw-custom input { position:absolute; inset:0; width:100%; height:100%; opacity:0; padding:0; border:0; cursor:pointer; }
    .tag-edit-row { display:flex; gap:6px; justify-content:flex-end; }
    .tag-mgr-save, .tag-mgr-cancel { padding:4px 12px; border-radius:6px; font-size:12px; cursor:pointer; }
    .tag-mgr-save { background:var(--accent); border:1px solid var(--accent); color:var(--accent-fg); font-weight:600; }
    .tag-mgr-cancel { background:var(--bg-surface); border:1px solid var(--border-subtle); color:var(--fg-default); }
    /* Tag manager modal */
    .tag-mgr-list { display:flex; flex-direction:column; gap:6px; max-height:55vh; overflow-y:auto; }
    .tag-mgr-row { display:flex; align-items:center; gap:9px; padding:7px 9px; background:var(--bg-deep);
      border:1px solid var(--border-subtle); border-radius:8px; }
    .tag-mgr-swatch { width:14px; height:14px; border-radius:50%; flex:0 0 auto; position:relative; cursor:pointer;
      border:1px solid color-mix(in srgb, var(--fg-default) 18%, transparent); }
    .tag-mgr-swatch input { position:absolute; inset:0; width:100%; height:100%; opacity:0; padding:0; border:0; cursor:pointer; }
    .tag-mgr-name { flex:1; min-width:0; background:var(--bg-surface); border:1px solid var(--border-subtle);
      border-radius:6px; padding:5px 9px; font-size:13px; color:var(--fg-default); }
    .tag-mgr-name:focus { outline:none; border-color:var(--accent); }
    .tag-mgr-badge { flex:0 0 auto; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.5px;
      padding:2px 6px; border-radius:4px; white-space:nowrap; }
    .tag-mgr-badge.in-use { background:rgba(166,227,161,0.12); color:var(--ok); border:1px solid rgba(166,227,161,0.25); }
    .tag-mgr-badge.orphaned { background:rgba(255,255,255,0.04); color:var(--fg-faded); border:1px solid var(--border-subtle); }
    .tag-mgr-bar { display:flex; align-items:center; gap:10px; margin:2px 0 10px; }
    .tag-mgr-bar .help { flex:1; margin:0; }
    .tag-mgr-bar .btn { flex:0 0 auto; padding:6px 11px; font-size:12px; }
    .chip .x { background:none; border:none; padding:0; margin:0; color:var(--fg-faded); cursor:pointer; font-size:14px; line-height:1; }
    .chip .x:hover { color:var(--err); }
    .tag-add { width:84px; padding:4px 10px; border-radius:999px; font-size:11.5px; background:var(--bg-deep); }

    button,.btn { font:inherit; color:var(--fg-default); background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--r-sm);
      padding:8px 12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;
      transition:background .12s, border-color .12s, color .12s, opacity .12s; }
    button:hover,.btn:hover { background:color-mix(in srgb, var(--bg-elevated), var(--fg-default) 9%); border-color:color-mix(in srgb, var(--border), var(--fg-default) 18%); }
    button:active { transform:translateY(.5px); }
    button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
    button[disabled] { opacity:.45; cursor:default; }
    .primary { background:var(--accent); border-color:var(--accent); color:var(--accent-fg); font-weight:600; }
    .primary:hover { background:color-mix(in srgb, var(--accent), black 12%); border-color:color-mix(in srgb, var(--accent), black 12%); }
    .ghost { background:transparent; border-color:transparent; color:var(--fg-muted); padding:6px; }
    .ghost:hover { background:var(--hover); color:var(--fg-default); }
    input,textarea,select { font:inherit; color:var(--fg-default); background:var(--bg-deep); border:1px solid var(--border); border-radius:var(--r-sm); padding:9px 12px; }
    input::placeholder,textarea::placeholder { color:var(--fg-faded); }
    input[type=number] { width:60px; text-align:center; }
    input[type=checkbox] { accent-color:var(--accent); width:16px; height:16px; }

    main { grid-column:3; grid-row:2; display:flex; flex-direction:column; min-width:0; min-height:0; padding:18px 20px; gap:14px; overflow-y:auto; }
    .appbar { display:flex; gap:8px; align-items:center; }
    .appbar input { flex:1; }
    .ham { display:inline-flex; align-items:center; justify-content:center; background:transparent; border:none; color:var(--fg-muted); cursor:pointer; padding:6px; border-radius:var(--r-sm); flex:0 0 auto; }
    .ham:hover { background:var(--hover); color:var(--fg-default); }
    .hdot { width:9px; height:9px; border-radius:999px; background:var(--fg-faded); flex:0 0 auto; margin-left:4px; transition:background var(--ui-motion-fast); }
    .hdot.ok { background:var(--ok); box-shadow:0 0 8px color-mix(in srgb, var(--ok) 70%, transparent); }
    .hdot.warn { background:var(--warn); box-shadow:0 0 8px color-mix(in srgb, var(--warn) 70%, transparent); }
    .compat-warn { background:color-mix(in srgb, var(--warn) 18%, transparent); border:1px solid var(--warn); color:var(--fg-default); border-radius:var(--r-sm); padding:8px 11px; font-size:12.5px; line-height:1.45; }
    .appbar input, .appbar .ghost, .appbar .primary, .np-actions .ghost { height:32px; box-sizing:border-box; border-radius:6px; }
    .appbar input { border:1px solid color-mix(in srgb, var(--accent) 45%, transparent); box-shadow:0 1px 2px rgba(0,0,0,.3); }
    .appbar input:focus-visible { outline:none; border-color:var(--kbd-cursor, var(--accent)); }
    .appbar .ghost, .np-actions .ghost { border:1px solid color-mix(in srgb, var(--accent) 45%, transparent); box-shadow:0 1px 2px rgba(0,0,0,.3); background:var(--bg-elevated); color:var(--fg-muted); padding:0 10px; }
    .appbar .ghost:hover, .np-actions .ghost:hover { border-color:var(--accent); color:var(--fg-default); background:var(--border-subtle); }
    .nowplaying { display:flex; align-items:center; gap:12px; }
    .np-actions { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
    .np-main { flex:1; min-width:0; }
    .np-title { font-weight:650; font-size:15.5px; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:text; }
    .np-title:hover { color:var(--accent); }
    .np-title-edit { font-weight:650; font-size:15.5px; letter-spacing:-.01em; width:100%; background:var(--bg-deep); border:1px solid var(--accent); border-radius:var(--r-sm); padding:2px 8px; color:var(--fg-default); }
    .np-meta { font-size:12px; color:var(--fg-faded); margin-top:1px; }
    .np-link { font-size:12px; cursor:pointer; flex:0 0 auto; }
    /* Subtle, out-of-the-way: override the accent-pill treatment for now-playing actions. */
    .np-actions .ghost { height:auto; border:none; box-shadow:none; background:transparent; color:var(--fg-faded); padding:5px 8px; }
    .np-actions .ghost:hover { border:none; background:var(--hover); color:var(--fg-default); }
    #playerWrap { position:relative; background:#000; border:1px solid var(--border-subtle); border-radius:var(--r); overflow:hidden; aspect-ratio:16/9; width:100%; max-width:calc(68vh * 16 / 9); align-self:center; flex:0 0 auto; box-shadow:0 10px 34px rgba(0,0,0,.45); }
    #player { width:100%; height:100%; }
    .fs-btn { position:absolute; bottom:10px; right:10px; z-index:4; display:inline-flex; padding:7px; border-radius:var(--r-sm);
      background:color-mix(in srgb, var(--bg-deep) 55%, transparent); border:1px solid transparent; color:#fff; opacity:0; cursor:pointer; transition:opacity var(--ui-motion-fast); }
    #playerWrap:hover .fs-btn { opacity:.85; }
    .fs-btn:hover { opacity:1; background:color-mix(in srgb, var(--bg-deep) 80%, transparent); }
    .fs-note { position:absolute; inset:0; z-index:6; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.45); backdrop-filter:blur(2px); }
    .fs-note-card { width:min(560px, 88%); display:flex; flex-direction:column; gap:9px; padding:14px; border-radius:12px;
      background:var(--bg-elevated); border:1px solid var(--accent); box-shadow:0 20px 56px rgba(0,0,0,.6); }
    .fs-note-head { display:flex; align-items:baseline; gap:8px; }
    .fs-note-card .ts { color:var(--accent); font-variant-numeric:tabular-nums; font-weight:600; font-size:13px; }
    .fs-note-card textarea { width:100%; min-height:92px; resize:vertical; font:inherit; font-size:14px; color:var(--fg-default);
      background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:9px 11px; }
    .fs-note-card textarea:focus { outline:none; border-color:var(--accent); }
    .fs-note-foot { display:flex; align-items:center; gap:8px; }
    #timeline { position:relative; height:10px; background:var(--bg-elevated); border-radius:99px; cursor:pointer; flex:0 0 auto; margin:2px 0; }
    #progress { position:absolute; inset:0 100% 0 0; background:linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent), white 22%)); border-radius:99px; }
    .marker { position:absolute; top:-3px; width:3px; height:16px; background:var(--accent); border-radius:2px; transform:translateX(-50%); box-shadow:0 0 0 2px var(--bg-deep); }
    .marker:hover { width:5px; }
    .toolbar { display:flex; gap:8px; align-items:center; }
    .toolbar input { flex:1; }
    .kbd { font-size:11px; color:color-mix(in srgb, var(--accent-fg) 72%, transparent); font-weight:600; padding-left:2px; }
    .status { color:var(--fg-muted); font-size:12px; white-space:nowrap; }
    .toasts { position:fixed; right:16px; bottom:16px; z-index:50; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
    .toast { display:flex; align-items:center; gap:10px; background:var(--bg-elevated); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:var(--r-sm); padding:9px 13px; font-size:13px; font-weight:500; color:var(--fg-default); box-shadow:0 10px 30px rgba(0,0,0,.5); max-width:360px; animation:toast-in var(--ui-motion) cubic-bezier(.34,1.26,.64,1) both; }
    .toast .ti { flex:0 0 auto; width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; background:var(--accent); color:var(--bg-deep); }
    .toast.ok .ti { background:var(--ok); } .toast.err .ti { background:var(--err); }
    .toast.ok { border-left-color:var(--ok); }
    .toast.err { border-left-color:var(--err); }
    @keyframes toast-in { from { opacity:0; transform:translateX(calc(100% + 24px)); } to { opacity:1; transform:none; } }
    details.menu { position:relative; flex:0 0 auto; }
    details.menu > summary { list-style:none; cursor:pointer; display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
    details.menu > summary::-webkit-details-marker { display:none; }
    .menu-pop { position:absolute; right:0; top:calc(100% + 4px); z-index:20; display:flex; flex-direction:column; gap:1px; min-width:170px;
      background:var(--bg-elevated); border:var(--popup-border, 1px solid var(--border)); border-radius:var(--r-sm); padding:4px; box-shadow:0 12px 34px rgba(0,0,0,.5); }
    .menu-pop button { display:flex; align-items:center; gap:8px; justify-content:flex-start; width:100%; background:transparent; border:none; border-radius:6px; padding:7px 9px; color:var(--fg-default); }
    .menu-pop button:hover { background:var(--hover); }
    .menu-pop button.on { color:var(--accent); }
    .menu-pop button[disabled] { opacity:.45; cursor:not-allowed; }
    .tabs { display:flex; gap:2px; background:var(--bg-deep); border:1px solid var(--border); border-radius:var(--r-sm); padding:2px; flex:0 0 auto; }
    .tab { background:transparent; border:none; color:var(--fg-muted); padding:5px 12px; border-radius:6px; }
    .tab:hover { color:var(--fg-default); background:transparent; }
    .tab.on { background:var(--bg-elevated); color:var(--fg-default); }
    .transcript { gap:1px; display:flex; flex-direction:column; }
    .seg { display:flex; gap:10px; align-items:baseline; text-align:left; width:100%; background:transparent; border:1px solid transparent; border-radius:6px; padding:6px 9px; color:var(--fg-default); line-height:1.5; }
    .seg:hover { background:var(--hover); }
    .seg .ts { background:none; padding:0; }
    .seg .spk { color:var(--accent); font-weight:600; font-size:11px; }
    .chapters { display:flex; flex-direction:column; gap:1px; }
    .chap { display:flex; gap:10px; align-items:baseline; text-align:left; width:100%; background:transparent; border:1px solid transparent; border-radius:6px; padding:7px 9px; color:var(--fg-default); line-height:1.45; }
    .chap:hover { background:var(--hover); }
    .chap .ts { background:none; padding:0; flex:0 0 auto; }
    .chap .grow { display:flex; flex-direction:column; gap:2px; }
    .chap-title { font-weight:600; }
    .chap-sum { color:var(--fg-muted); font-size:12px; }
    /* Phoneme transcript pane: Transcript / Compare / Summary */
    .tpane { display:flex; flex-direction:column; gap:10px; }
    .tview-tabs { display:flex; gap:2px; background:var(--bg-deep); border:1px solid var(--border); border-radius:var(--r-sm); padding:2px; align-self:flex-start; position:sticky; top:0; z-index:1; }
    .tview-tabs .tab { padding:4px 12px; }
    .tflow { white-space:pre-wrap; line-height:1.6; padding:4px 2px; }
    .pl-stage { display:flex; align-items:center; gap:9px; font-weight:550; color:var(--fg-default); }
    .spin { width:14px; height:14px; border-radius:50%; border:2px solid var(--border); border-top-color:var(--accent); animation:spin 0.8s linear infinite; flex:0 0 auto; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .cmp { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .cmp-col { display:flex; flex-direction:column; gap:6px; min-width:0; }
    .cmp-head select { width:100%; }
    .cmp-text { white-space:pre-wrap; line-height:1.55; font-size:12.5px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--r-sm); padding:10px 12px; }
    .sumpane { display:flex; flex-direction:column; gap:14px; }
    .sblock h4 { margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--accent); font-weight:700; }
    .sblock p { margin:0; line-height:1.6; }
    .ents { display:flex; flex-wrap:wrap; gap:6px; }
    .ent { padding:2px 9px; border-radius:999px; background:var(--tint); color:var(--accent); font-size:12px; }
    .tasks { margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px; }
    .tasks li.done { color:var(--fg-faded); text-decoration:line-through; }
    .smeta { border-top:1px solid var(--border-subtle); padding-top:8px; }

    .notes { display:flex; flex-direction:column; gap:8px; padding-right:3px; }
    .note { display:flex; gap:12px; align-items:flex-start; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--r); padding:12px 14px; transition:border-color .12s, box-shadow .12s; }
    .note:hover { border-color:var(--border); box-shadow:0 2px 14px rgba(0,0,0,.28); }
    .note.selected { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset; }
    .ts { flex:0 0 auto; font-variant-numeric:tabular-nums; font-size:12px; font-weight:600; color:var(--accent);
      background:var(--tint); border:none; border-radius:6px; padding:3px 8px; cursor:pointer; margin-top:1px; }
    .ts:hover { filter:brightness(1.12); }
    .body { flex:1; min-width:0; word-break:break-word; font-size:14px; line-height:1.55; }
    .body>:first-child { margin-top:0; } .body>:last-child { margin-bottom:0; }
    .body p { margin:.3em 0; } .body a { color:var(--accent); }
    .body code { background:var(--bg-deep); padding:1px 5px; border-radius:4px; font-size:.9em; }
    .body ul,.body ol { margin:.3em 0; padding-left:1.3em; }
    .acts { display:flex; gap:2px; opacity:0; transition:opacity .12s; flex:0 0 auto; }
    .note:hover .acts { opacity:1; }
    textarea { width:100%; resize:vertical; min-height:62px; line-height:1.5; }
    .empty { min-height:46vh; display:flex; flex-direction:column; align-items:center; justify-content:center; margin-inline:auto; text-align:center; color:var(--fg-muted); max-width:340px; line-height:1.6; padding:40px; }
    .empty h3 { margin:0 0 8px; color:var(--fg-default); font-size:14px; font-weight:600; }
    .empty p { margin:0; color:var(--fg-faded); }
    .empty.src { display:flex; flex-direction:column; gap:10px; align-items:center; }
    .linkbtn { background:none; border:none; color:var(--accent); cursor:pointer; padding:4px 0 0; font:inherit; }
    .linkbtn:hover { text-decoration:underline; background:none; }
    .kbd2 { background:var(--bg-elevated); border:1px solid var(--border); border-radius:5px; padding:1px 6px; color:var(--fg-default); font-size:12px; }

    .overlay { position:fixed; inset:0; background:color-mix(in srgb, var(--bg-deep) 68%, transparent); backdrop-filter:blur(4px);
      display:flex; justify-content:center; padding-top:11vh; z-index:10; }
    .panel { background:var(--bg-surface); border:var(--popup-border, 1px solid var(--border)); border-radius:14px; box-shadow:0 24px 70px rgba(0,0,0,.6);
      padding:16px; width:min(640px,92vw); max-height:74vh; overflow:auto; display:flex; flex-direction:column; gap:12px; }
    .panel-head { display:flex; align-items:center; justify-content:space-between; font-weight:650; font-size:15px; }
    .field { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .field>span { color:var(--fg-muted); font-size:13px; }
    .field.col { flex-direction:column; align-items:stretch; gap:6px; }
    .field.col>span { color:var(--fg-faded); }
    .field select, .field.col input { min-width:200px; } .field.col input, .field.col select { width:100%; }
    .row2 { display:flex; gap:8px; }
    .settings-section { display:flex; flex-direction:column; gap:10px; border:1px solid var(--border-subtle); border-radius:var(--r-sm); padding:10px 12px 12px; }
    .settings-section h3 { margin:0; font-size:10.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--accent); font-weight:700; }
    .help { color:var(--fg-faded); margin-top:-4px; line-height:1.45; }
    .adv > summary { list-style:none; cursor:pointer; color:var(--fg-faded); font-size:12px; padding:4px 0; }
    .adv > summary::-webkit-details-marker { display:none; }
    .adv > summary:hover { color:var(--accent); }
    .adv[open] { display:flex; flex-direction:column; gap:10px; }
    .hint { border-top:1px solid var(--border-subtle); padding-top:10px; line-height:1.7; }
    .hint b { color:var(--fg-default); font-weight:600; }
    .sbar { display:flex; align-items:center; gap:8px; background:var(--bg-deep); border:1px solid var(--border); border-radius:var(--r-sm); padding:0 11px; color:var(--fg-muted); }
    .sbar input { flex:1; background:transparent; border:none; padding:10px 0; }
    .sbar input:focus-visible { outline:none; }
    .results { overflow:auto; display:flex; flex-direction:column; gap:3px; }
    .hit { display:flex; gap:10px; text-align:left; align-items:baseline; background:transparent; border:1px solid transparent; border-radius:var(--r-sm); padding:9px 10px; width:100%; }
    .hit:hover { background:var(--hover); }
    .hit .htitle { font-weight:600; }
    .src-label { font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--fg-faded); padding:10px 10px 3px; border-top:1px solid var(--border-subtle); margin-top:4px; }
    .cheat { display:grid; grid-template-columns:auto 1fr; gap:7px 16px; align-items:center; overflow:auto; }
    .cheat-row { display:contents; }
    .cheat kbd { justify-self:start; font:inherit; font-size:11.5px; background:var(--bg-elevated); border:1px solid var(--border); border-bottom-width:2px; border-radius:5px; padding:1px 7px; color:var(--fg-default); white-space:nowrap; }
    .cheat-row span { color:var(--fg-muted); }
  `;
}

function loadSettings(): Settings {
  const def: Settings = { offset: 3, autopause: true, vaultDir: "", theme: "catppuccin-mocha", stripTitlebar: false, gClientId: "", gClientSecret: "", hiddenPlaylists: [], phonemeBin: "", syncTags: true };
  try { return { ...def, ...JSON.parse(localStorage.getItem("ytnt.settings") || "{}") }; }
  catch { return def; }
}
function download(name: string, text: string, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
declare global { interface HTMLElementTagNameMap { "ytnt-app": App; } }
