import { LitElement, html, css, svg, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { api, type VideoWithCount, type Note, type SearchHit, type Segment, type PhonemeHit } from "./api";
import { Player } from "./player";
import { parseVideoId, formatTime, applyOffset, notesToMarkdown, tsLink } from "./lib";
import { renderMarkdown } from "./markdown";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check } from "@tauri-apps/plugin-updater";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
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

interface Settings { offset: number; autopause: boolean; vaultDir: string; theme: string; stripTitlebar: boolean; }
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
  @state() private libView: "all" | "transcript" = "all";
  @state() private folds: Record<string, boolean> = {};
  @state() private cheatOpen = false;
  @state() private findReplaceOpen = false;
  @state() private sortDesc = true;
  @state() private selected = new Set<string>();
  @state() private fsNote: { t: number } | null = null;
  @state() private titleEditing = false;
  @state() private phonemeOk = false;
  @state() private view: "notes" | "transcript" = "notes";
  @state() private rate = 1;
  @state() private segments: Segment[] = [];
  @state() private transcriptBusy = false;
  @state() private sidebarOpen = localStorage.getItem("ytnt.sidebar") !== "0";

  private player: Player | null = null;
  private lastSaved = 0;
  private lastFocus: HTMLElement | null = null;
  private settings: Settings = loadSettings();

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && (this.searchOpen || this.settingsOpen || this.cheatOpen || this.findReplaceOpen)) { this.cheatOpen = false; this.findReplaceOpen = false; this.closeModal(); return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.composedPath()[0] as HTMLElement)?.tagName ?? "");
    if (typing || this.searchOpen || this.settingsOpen || this.cheatOpen || this.findReplaceOpen) return;
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
  }

  firstUpdated() {
    this.refreshVideos();
    const el = this.renderRoot.querySelector("#player") as HTMLElement;
    this.player = new Player(el);
    this.player.onTick = (t, d) => this.onTick(t, d);
    this.player.onTitle = (title) => this.onTitle(title);
    this.player.onError = (code) => this.onPlayerError(code);
    api.phonemeAvailable().then((ok) => (this.phonemeOk = ok)).catch(() => {});
    win()?.setDecorations(!this.settings.stripTitlebar)?.catch(() => {});
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
  private async refreshNotes() { this.notes = this.currentId ? await api.listNotes(this.currentId) : []; }

  private async loadVideo(id: string, url?: string) {
    this.currentId = id;
    this.editing = null; this.filter = ""; this.dur = 0; this.lastSaved = 0; this.selectedId = null;
    this.view = "notes"; this.segments = [];
    await api.upsertVideo(id, url ?? `https://youtu.be/${id}`);
    await this.refreshVideos();
    this.player?.load(id, this.current?.last_pos_secs ?? 0);
    await this.refreshNotes();
  }

  private addFromInput() {
    const input = this.renderRoot.querySelector("#url") as HTMLInputElement;
    const id = parseVideoId(input.value);
    if (!id) { this.flash("Not a valid YouTube URL", "err"); return; }
    const raw = input.value.trim(); input.value = "";
    this.loadVideo(id, /^https?:/.test(raw) ? raw : `https://youtu.be/${id}`);
  }

  private capture() {
    if (!this.player || !this.currentId) return;
    const t = applyOffset(this.player.currentTime, this.settings.offset);
    if (this.settings.autopause) this.player.pause();
    // In our fullscreen, the notes pane is hidden — capture via an overlay that
    // lives inside #playerWrap so it renders on top of the fullscreened video.
    const pw = this.renderRoot.querySelector("#playerWrap");
    if (document.fullscreenElement && document.fullscreenElement === pw) {
      this.fsNote = { t };
      this.updateComplete.then(() => (this.renderRoot.querySelector("#fsNoteInput") as HTMLInputElement)?.focus());
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
    const vid = this.videos.find((v) => v.ext_ref === h.id)?.id;
    if (vid) { this.closeModal(); this.loadVideo(vid); }
    else this.flash("That Phoneme recording isn't linked to a video here.");
  }

  // ── Modal focus management (a11y) ────────────────────────────────────────
  private focusables(): HTMLElement[] {
    const panel = this.renderRoot.querySelector(".overlay .panel") as HTMLElement | null;
    if (!panel) return [];
    return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisible);
  }
  private openModal(which: "search" | "settings") {
    this.lastFocus = ((this.renderRoot as ShadowRoot).activeElement as HTMLElement) ?? null;
    if (which === "search") { this.searchResults = []; this.phonemeHits = []; this.searchOpen = true; }
    else this.settingsOpen = true;
    this.updateComplete.then(() => this.focusables()[0]?.focus());
  }
  private closeModal() {
    this.searchOpen = false; this.settingsOpen = false;
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
  private recId(): string | null { return this.current?.ext_ref ?? null; }
  private async setRecId(rec: string) {
    if (!this.currentId) return;
    await api.setExtRef(this.currentId, rec);
    await this.refreshVideos();
  }
  private async sendToPhoneme() {
    const v = this.current; if (!v) return;
    this.transcriptBusy = true; this.flash("Sending to Phoneme… (download + queue)");
    try { const rec = await api.phonemeImport(v.url); await this.setRecId(rec); this.flash("Queued — transcribing in Phoneme"); }
    catch (e) { this.flash(String(e), "err"); }
    finally { this.transcriptBusy = false; }
  }
  private async loadTranscript() {
    const rec = this.recId(); if (!rec) return;
    this.transcriptBusy = true;
    try { this.segments = await api.phonemeSegments(rec); if (!this.segments.length) this.flash("Still transcribing… try again shortly"); }
    catch (e) { this.flash(String(e), "err"); }
    finally { this.transcriptBusy = false; }
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
    this.flash(`Tagged ${n} video${n > 1 ? "s" : ""} “${t}”`, "ok");
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
    await api.deleteVideo(id);
    if (this.currentId === id) { this.currentId = null; this.notes = []; }
    await this.refreshVideos();
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
  private toggleFold(k: string) { this.folds = { ...this.folds, [k]: !this.folds[k] }; }
  updated() { this.toggleAttribute("collapsed", !this.sidebarOpen); }
  private allTags(): string[] {
    return [...new Set(this.videos.flatMap((v) => v.tags))].sort((a, b) => a.localeCompare(b));
  }
  private async addTag(name: string) {
    const v = this.current; const t = name.trim();
    if (!v || !t || v.tags.includes(t)) return;
    await api.setVideoTags(v.id, [...v.tags, t]); await this.refreshVideos();
  }
  private async removeTag(name: string) {
    const v = this.current; if (!v) return;
    await api.setVideoTags(v.id, v.tags.filter((x) => x !== name)); await this.refreshVideos();
  }

  render() {
    const filtered = this.displayed();
    const tags = this.allTags();
    const transcriptCount = this.videos.filter((v) => v.ext_ref).length;
    let vids = this.libView === "transcript" ? this.videos.filter((v) => v.ext_ref) : this.videos;
    if (this.tagFilter) vids = vids.filter((v) => v.tags.includes(this.tagFilter!));
    vids = [...vids];
    if (!this.sortDesc) vids.reverse();          // list arrives newest-first; reverse → oldest-first
    vids.sort((a, b) => Number(b.pinned) - Number(a.pinned)); // stable: pinned float to top
    const trapped = this.searchOpen || this.settingsOpen || this.cheatOpen || this.findReplaceOpen;
    return html`
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
              @click=${() => { this.libView = "all"; this.tagFilter = null; }}>
              <span class="si-icon">${I.film}</span><span class="si-label">All videos</span><span class="count">${this.videos.length}</span>
            </button>
            <button class="sidebar-item ${this.libView === "transcript" ? "on" : ""}"
              @click=${() => { this.libView = "transcript"; this.tagFilter = null; }}>
              <span class="si-icon">${I.captions}</span><span class="si-label">With transcript</span><span class="count">${transcriptCount}</span>
            </button>` : nothing}
        </div>
        ${tags.length ? html`<div class="section">
          <button class="sec-head" @click=${() => this.toggleFold("tags")}>
            <span class="chev ${this.folds.tags ? "" : "open"}">${I.chev}</span> Tags
          </button>
          ${!this.folds.tags ? tags.map((t) => html`
            <button class="sidebar-item ${this.tagFilter === t ? "on" : ""}"
              @click=${() => (this.tagFilter = this.tagFilter === t ? null : t)}>
              <span class="si-icon tag-hash">#</span><span class="si-label">${t}</span>
              <span class="count">${this.videos.filter((v) => v.tags.includes(t)).length}</span>
            </button>`) : nothing}
        </div>` : nothing}
        ${this.selected.size ? html`<div class="bulkbar">
          <span>${this.selected.size} selected</span>
          <input class="bulk-tag" type="text" placeholder="+ tag…" title="Add a tag to selected"
            @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") { this.bulkTag((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} />
          <span class="grow"></span>
          <button class="danger" @click=${() => this.bulkDelete()}>Delete</button>
          <button class="ghost" @click=${() => (this.selected = new Set())}>Clear</button>
        </div>` : nothing}
        <div class="lib">
          ${vids.length ? vids.map((v) => html`
            <div class="libcard ${v.id === this.currentId ? "active" : ""} ${this.selected.has(v.id) ? "sel" : ""}" @click=${() => this.toggleVideo(v.id, v.url)}>
              <input class="lc-check" type="checkbox" title="Select" .checked=${this.selected.has(v.id)}
                @click=${(e: Event) => e.stopPropagation()} @change=${() => this.toggleSelect(v.id)} />
              <img class="thumb" loading="lazy" src=${`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                @error=${(e: Event) => ((e.target as HTMLElement).style.visibility = "hidden")} />
              <div class="meta">
                <div class="t" title=${v.title || v.id}>${v.title || v.id}</div>
                <div class="c">${v.note_count} ${v.note_count === 1 ? "note" : "notes"}${v.ext_ref ? html` · <span class="pill tx">transcript</span>` : nothing}</div>
                ${v.tags.length ? html`<div class="ctags">${v.tags.map((t) => html`<span class="ctag">${t}</span>`)}</div>` : nothing}
              </div>
              <div class="lc-actions">
                <button class="ghost pin ${v.pinned ? "on" : ""}" title=${v.pinned ? "Unpin" : "Pin to top"} @click=${(e: Event) => { e.stopPropagation(); this.togglePin(v.id, v.pinned); }}>${I.pin}</button>
                <button class="ghost rm" title="Remove" @click=${(e: Event) => { e.stopPropagation(); this.removeVideo(v.id); }}>${I.close}</button>
              </div>
            </div>`) : html`<div class="empty-lib">${this.videos.length
              ? html`No videos match this filter.<br /><button class="linkbtn" @click=${() => { this.tagFilter = null; this.libView = "all"; }}>Clear filters</button>`
              : "No videos yet — load one to start."}</div>`}
        </div>
      </aside>

      <main ?inert=${trapped}>
        ${!this.currentId ? html`<div class="topbar" ?data-tauri-drag-region=${this.settings.stripTitlebar}>
          <button class="ham" title="Toggle sidebar" aria-label="Toggle sidebar" @click=${() => this.toggleSidebar()}>${I.menu}</button>
          <input id="url" type="text" placeholder="Paste a YouTube URL or id…" autocomplete="off"
            @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this.addFromInput()} />
          <button class="primary" @click=${() => this.addFromInput()}>Load</button>
          <button class="ghost" title="Search all notes" aria-label="Search all notes" @click=${() => this.openModal("search")}>${I.search}</button>
          <button class="ghost" title="Settings" aria-label="Settings" @click=${() => this.openModal("settings")}>${I.gear}</button>
          <span class="hdot ${this.phonemeOk ? "ok" : ""}" title=${this.phonemeOk ? "Phoneme connected" : "Phoneme not detected"}></span>
        </div>` : nothing}

        ${this.current ? html`<div class="nowplaying" ?data-tauri-drag-region=${this.settings.stripTitlebar}>
          <button class="ham" title="Toggle sidebar" aria-label="Toggle sidebar" @click=${() => this.toggleSidebar()}>${I.menu}</button>
          <div class="np-main">
            ${this.titleEditing
              ? html`<input class="np-title-edit" type="text" .value=${this.current.title || ""}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); this.saveTitle((e.target as HTMLInputElement).value); } else if (e.key === "Escape") { e.preventDefault(); this.titleEditing = false; } }}
                  @blur=${(e: Event) => this.saveTitle((e.target as HTMLInputElement).value)} />`
              : html`<div class="np-title" title="Click to rename" @click=${() => { this.titleEditing = true; this.updateComplete.then(() => (this.renderRoot.querySelector(".np-title-edit") as HTMLInputElement)?.select()); }}>${this.current.title || this.current.id}</div>`}
            <div class="np-meta">${this.current.channel || ""}${(this.dur || this.current.duration) ? html` · ${formatTime(this.dur || this.current.duration || 0)}` : nothing}</div>
          </div>
          <div class="np-actions">
            <a class="np-link" @click=${() => window.open(`https://www.youtube.com/watch?v=${this.current!.id}`, "_blank")}>Open on YouTube ↗</a>
            <button class="ghost" title="Search all notes" aria-label="Search all notes" @click=${() => this.openModal("search")}>${I.search}</button>
            <button class="ghost" title="Settings" aria-label="Settings" @click=${() => this.openModal("settings")}>${I.gear}</button>
            <span class="hdot ${this.phonemeOk ? "ok" : ""}" title=${this.phonemeOk ? "Phoneme connected" : "Phoneme not detected"}></span>
          </div>
        </div>` : nothing}
        <div id="playerWrap" class=${this.currentId ? "" : "hidden"}>
          <div id="player"></div>
          ${this.currentId ? html`<button class="fs-btn" title="Fullscreen (F) — add notes without leaving" @click=${() => this.toggleFullscreen()}>${I.expand}</button>` : nothing}
          ${this.fsNote ? html`<div class="fs-note">
            <span class="ts">${formatTime(this.fsNote.t)}</span>
            <input id="fsNoteInput" type="text" placeholder="Note at this moment — Enter to save, Esc to cancel"
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter") { e.preventDefault(); this.fsCommit((e.target as HTMLInputElement).value); }
                else if (e.key === "Escape") { e.preventDefault(); this.fsCancel(); }
              }} />
            <button class="primary" @click=${() => this.fsCommit((this.renderRoot.querySelector("#fsNoteInput") as HTMLInputElement)?.value || "")}>Add</button>
          </div>` : nothing}
        </div>
        <div id="timeline" class=${this.currentId ? "" : "hidden"} title="click to seek" @click=${(e: MouseEvent) => this.timelineClick(e)}>
          <div id="progress"></div>
          ${this.dur ? this.notes.map((n) => html`<div class="marker" style="left:${(n.t_secs / this.dur) * 100}%"
            title=${`${formatTime(n.t_secs)} — ${n.content}`}
            @click=${(e: Event) => { e.stopPropagation(); this.seek(n.t_secs); }}></div>`) : nothing}
        </div>

        ${this.current ? html`<div class="vtags">
          ${this.current.tags.map((t) => html`<span class="chip tag">${t}<button class="x" title="Remove tag" aria-label="Remove tag ${t}" @click=${() => this.removeTag(t)}>×</button></span>`)}
          <input class="tag-add" type="text" placeholder="+ tag" aria-label="Add tag"
            @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") { this.addTag((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; } }} />
        </div>` : nothing}

        <div class="toolbar ${this.currentId ? "" : "hidden"}">
          <div class="tabs">
            <button class="tab ${this.view === "notes" ? "on" : ""}" @click=${() => (this.view = "notes")}>Notes</button>
            <button class="tab ${this.view === "transcript" ? "on" : ""}" @click=${() => (this.view = "transcript")}>Transcript</button>
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
            ${this.segments.length ? html`<button @click=${() => (this.segments = [])}>Sources</button>` : nothing}
          `}
          ${this.currentId ? html`<details class="menu">
            <summary class="ghost" title="Playback speed">${this.rate}× ${I.caret}</summary>
            <div class="menu-pop">
              ${[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => html`<button class=${s === this.rate ? "on" : ""} @click=${(ev: Event) => { this.closeMenu(ev); this.setSpeed(s); }}>${s}×</button>`)}
            </div>
          </details>` : nothing}
          <span class="grow"></span>
        </div>

        ${this.view === "notes"
          ? html`<div class="notes" role="list" aria-label="Notes for this video" @click=${(e: Event) => this.onNotesClick(e)}>
              ${!this.currentId ? html`<div class="empty"><h3>No video loaded</h3><p>Paste a YouTube link above, then press <span class="kbd2">Alt&nbsp;+&nbsp;N</span> to capture a note at the current moment.</p></div>` : nothing}
              ${this.currentId && filtered.length === 0 && !this.editing ? html`<div class="empty"><h3>${this.filter ? "No matching notes" : "No notes yet"}</h3><p>${this.filter ? "Try a different search." : html`Press <span class="kbd2">Alt&nbsp;+&nbsp;N</span> to capture a note at the current moment.`}</p></div>` : nothing}
              ${this.editing && !this.editing.id ? this.renderEditor() : nothing}
              ${filtered.map((n) => (this.editing?.id === n.id ? this.renderEditor() : this.renderNote(n)))}
            </div>`
          : this.renderTranscript()}
      </main>

      ${this.searchOpen ? this.renderSearch() : nothing}
      ${this.settingsOpen ? this.renderSettings() : nothing}
      ${this.cheatOpen ? this.renderCheat() : nothing}
      ${this.findReplaceOpen ? this.renderFindReplace() : nothing}
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
          <h3>Updates</h3>
          <div class="field"><span>App updates</span>
            <button @click=${() => this.checkUpdates()}>Check for updates</button></div>
        </section>
        <div class="hint muted sm">Press <b>?</b> for keyboard shortcuts.</div>
      </div>
    </div>`;
  }

  private renderTranscript() {
    if (!this.currentId) return html`<div class="notes"><div class="empty">Load a video first.</div></div>`;
    if (this.segments.length) {
      return html`<div class="notes transcript">
        ${this.segments.map((s) => html`<button class="seg" @click=${() => this.seek(s.start_ms / 1000)}>
          <span class="ts">${formatTime(s.start_ms / 1000)}</span><span class="grow">${s.text}</span></button>`)}
      </div>`;
    }
    return html`<div class="notes"><div class="empty src">
      ${this.recId()
        ? html`<button class="primary" @click=${() => this.loadTranscript()} ?disabled=${this.transcriptBusy}>Load Phoneme transcript</button>`
        : this.phonemeOk
          ? html`<button class="primary" @click=${() => this.sendToPhoneme()} ?disabled=${this.transcriptBusy}>Send to Phoneme</button>`
          : nothing}
      <button @click=${() => this.loadCaptions()} ?disabled=${this.transcriptBusy}>Load YouTube captions</button>
      <div class="muted sm">${this.transcriptBusy
        ? "Working…"
        : this.phonemeOk
          ? "Phoneme gives a cleaned, reliable transcript. YouTube captions are a quick best-effort fallback."
          : "Phoneme not detected — captions are best-effort and many videos have none. Install Phoneme for reliable transcripts."}</div>
    </div></div>`;
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
      display:grid; grid-template-columns:264px 1fr; grid-template-rows:minmax(0,1fr);
      height:100vh; background:var(--bg-deep); color:var(--fg-default);
      font:13.5px/1.55 "Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
      -webkit-font-smoothing:antialiased;
    }
    :host([collapsed]) { grid-template-columns:0 1fr; }
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

    aside { background:var(--bg-surface); border-right:1px solid var(--border-subtle); display:flex; flex-direction:column; min-height:0; overflow:hidden; }
    .label { font-size:10.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--fg-faded); padding:14px 16px 6px; }
    .lib { flex:1; min-height:0; overflow:auto; padding:0 8px 8px; display:flex; flex-direction:column; gap:2px; }
    .libcard { display:flex; gap:9px; align-items:center; padding:6px; border-radius:var(--r-sm); cursor:pointer; position:relative; transition:background .12s; }
    .libcard:hover { background:var(--hover); }
    .libcard.active { background:var(--tint); box-shadow:inset 3px 0 0 var(--accent); }
    .libcard .thumb { width:58px; height:33px; border-radius:5px; object-fit:cover; background:#000; flex:0 0 auto; }
    .libcard .meta { min-width:0; flex:1; }
    .libcard .t { font-size:12.5px; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .libcard .c { font-size:11px; color:var(--fg-faded); margin-top:1px; }
    .libcard .tx { color:var(--accent); }
    .ctags { display:flex; flex-wrap:wrap; gap:3px; margin-top:3px; }
    .ctag { font-size:9.5px; padding:1px 6px; border-radius:999px; background:var(--bg-deep); color:var(--fg-muted); }
    .lc-actions { position:absolute; top:4px; right:4px; display:flex; gap:1px; }
    .libcard .lc-actions .ghost { padding:3px; opacity:0; }
    .libcard:hover .lc-actions .ghost { opacity:.6; }
    .libcard .lc-actions .ghost:hover { opacity:1; }
    .libcard .rm:hover { color:var(--err); }
    .libcard .pin.on { opacity:.95; color:var(--accent); }
    .lc-check { position:absolute; top:5px; left:5px; width:15px; height:15px; opacity:0; z-index:1; }
    .libcard:hover .lc-check, .libcard.sel .lc-check { opacity:1; }
    .libcard.sel { background:var(--tint); box-shadow:inset 3px 0 0 var(--accent); }
    .bulkbar { display:flex; align-items:center; gap:6px; padding:7px 10px; margin:4px 8px; background:var(--bg-elevated); border:1px solid var(--accent); border-radius:var(--r-sm); font-size:12px; }
    .bulk-tag { width:78px; padding:3px 8px; font-size:12px; }
    .bulk-tag:focus { width:120px; }
    .danger { background:var(--err); color:var(--bg-deep); border-color:var(--err); }
    .danger:hover { background:color-mix(in srgb, var(--err), black 12%); border-color:color-mix(in srgb, var(--err), black 12%); }
    .pill { padding:1px 7px; border-radius:999px; background:var(--tint); color:var(--accent); font-size:9.5px; }
    .empty-lib { color:var(--fg-faded); font-size:12px; padding:6px 16px; }
    .section { border-bottom:1px solid var(--border-subtle); padding:2px 8px 6px; }
    .sec-head { width:100%; display:flex; align-items:center; gap:6px; background:none; border:none; padding:8px 8px 4px; font-size:10.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--fg-faded); cursor:pointer; }
    .sec-head:hover { background:none; color:var(--fg-muted); }
    .sec-head-row { display:flex; align-items:center; }
    .sec-head-row .sec-head { flex:1; }
    .sort-btn { background:none; border:none; color:var(--fg-faded); font-size:10px; text-transform:uppercase; letter-spacing:.06em; cursor:pointer; padding:8px 8px 4px; white-space:nowrap; }
    .sort-btn:hover { color:var(--accent); background:none; }
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
    .sidebar-item .si-label { flex:1; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sidebar-item .count { margin-left:auto; flex:0 0 auto; min-width:20px; padding:1px 7px; border-radius:999px; text-align:center; font-size:11px; line-height:15px; font-variant-numeric:tabular-nums; color:var(--fg-faded); background:color-mix(in srgb, var(--fg-faded) 10%, transparent); }
    .sidebar-item.on .count, .sidebar-item:hover .count { color:color-mix(in srgb, var(--accent) 75%, var(--fg-default)); background:color-mix(in srgb, var(--accent) 16%, transparent); }
    .sidebar-item .dot { width:8px; height:8px; border-radius:999px; background:var(--accent); opacity:.85; flex:0 0 auto; }
    .tagbar { display:flex; flex-wrap:wrap; gap:5px; padding:0 12px 8px; }
    .chip { font:inherit; font-size:11.5px; padding:3px 9px; border-radius:999px; cursor:pointer; background:var(--bg-elevated);
      border:1px solid var(--border); color:var(--fg-muted); display:inline-flex; align-items:center; gap:5px; transition:color .12s, border-color .12s; }
    .chip:hover { color:var(--fg-default); }
    .chip.on { background:var(--tint); border-color:var(--accent); color:var(--accent); }
    .vtags { display:flex; flex-wrap:wrap; gap:6px; align-items:center; justify-content:flex-end; margin-top:-4px; }
    .chip.tag { color:var(--fg-default); cursor:default; }
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

    main { display:flex; flex-direction:column; min-width:0; min-height:0; padding:18px 20px; gap:14px; }
    .topbar { display:flex; gap:8px; align-items:center; }
    .topbar input { flex:1; }
    .ham { display:inline-flex; align-items:center; justify-content:center; background:transparent; border:none; color:var(--fg-muted); cursor:pointer; padding:6px; border-radius:var(--r-sm); flex:0 0 auto; }
    .ham:hover { background:var(--hover); color:var(--fg-default); }
    .hdot { width:9px; height:9px; border-radius:999px; background:var(--fg-faded); flex:0 0 auto; margin-left:12px; transition:background var(--ui-motion-fast); }
    .hdot.ok { background:var(--ok); box-shadow:0 0 8px color-mix(in srgb, var(--ok) 70%, transparent); }
    .topbar input, .topbar .ghost, .topbar .primary, .np-actions .ghost { height:32px; box-sizing:border-box; border-radius:6px; }
    .topbar input { border:1px solid color-mix(in srgb, var(--accent) 45%, transparent); box-shadow:0 1px 2px rgba(0,0,0,.3); }
    .topbar input:focus-visible { outline:none; border-color:var(--kbd-cursor, var(--accent)); }
    .topbar .ghost, .np-actions .ghost { border:1px solid color-mix(in srgb, var(--accent) 45%, transparent); box-shadow:0 1px 2px rgba(0,0,0,.3); background:var(--bg-elevated); color:var(--fg-muted); padding:0 10px; }
    .topbar .ghost:hover, .np-actions .ghost:hover { border-color:var(--accent); color:var(--fg-default); background:var(--border-subtle); }
    .nowplaying { display:flex; align-items:center; gap:12px; }
    .np-actions { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
    .np-main { flex:1; min-width:0; }
    .np-title { font-weight:650; font-size:15.5px; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:text; }
    .np-title:hover { color:var(--accent); }
    .np-title-edit { font-weight:650; font-size:15.5px; letter-spacing:-.01em; width:100%; background:var(--bg-deep); border:1px solid var(--accent); border-radius:var(--r-sm); padding:2px 8px; color:var(--fg-default); }
    .np-meta { font-size:12px; color:var(--fg-faded); margin-top:1px; }
    .np-link { color:var(--fg-muted); font-size:12px; cursor:pointer; flex:0 0 auto; }
    .np-link:hover { color:var(--accent); }
    #playerWrap { position:relative; background:#000; border:1px solid var(--border-subtle); border-radius:var(--r); overflow:hidden; aspect-ratio:16/9; width:100%; max-width:calc(68vh * 16 / 9); align-self:center; flex:0 0 auto; box-shadow:0 10px 34px rgba(0,0,0,.45); }
    #player { width:100%; height:100%; }
    .fs-btn { position:absolute; top:10px; right:10px; z-index:4; display:inline-flex; padding:7px; border-radius:var(--r-sm);
      background:color-mix(in srgb, var(--bg-deep) 55%, transparent); border:1px solid transparent; color:#fff; opacity:0; cursor:pointer; transition:opacity var(--ui-motion-fast); }
    #playerWrap:hover .fs-btn { opacity:.85; }
    .fs-btn:hover { opacity:1; background:color-mix(in srgb, var(--bg-deep) 80%, transparent); }
    .fs-note { position:absolute; left:50%; bottom:24px; transform:translateX(-50%); z-index:6; display:flex; align-items:center; gap:8px;
      background:color-mix(in srgb, var(--bg-deep) 92%, transparent); border:1px solid var(--accent); border-radius:var(--r); padding:8px 10px;
      box-shadow:0 14px 44px rgba(0,0,0,.6); width:min(680px, 82%); backdrop-filter:blur(6px); }
    .fs-note input { flex:1; }
    .fs-note .ts { color:var(--accent); font-variant-numeric:tabular-nums; font-size:12px; flex:0 0 auto; padding-left:2px; }
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
    .transcript { gap:1px; }
    .seg { display:flex; gap:10px; align-items:baseline; text-align:left; width:100%; background:transparent; border:1px solid transparent; border-radius:6px; padding:6px 9px; color:var(--fg-default); line-height:1.5; }
    .seg:hover { background:var(--hover); }
    .seg .ts { background:none; padding:0; }

    .notes { flex:1; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:8px; padding-right:3px; }
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
    .empty { margin:auto; text-align:center; color:var(--fg-muted); max-width:340px; line-height:1.6; padding:40px; }
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
  const def: Settings = { offset: 3, autopause: true, vaultDir: "", theme: "catppuccin-mocha", stripTitlebar: false };
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
