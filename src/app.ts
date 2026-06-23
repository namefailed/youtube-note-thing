import { LitElement, html, css, svg, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { api, type VideoWithCount, type Note, type SearchHit } from "./api";
import { Player } from "./player";
import { parseVideoId, formatTime, applyOffset, notesToMarkdown } from "./lib";
import { renderMarkdown } from "./markdown";
import { getCurrentWindow } from "@tauri-apps/api/window";

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
  min: svg`<svg viewBox="0 0 24 24" class="i"><path d="M5 12h14"/></svg>`,
  max: svg`<svg viewBox="0 0 24 24" class="i"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`,
  copy: svg`<svg viewBox="0 0 24 24" class="i"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`,
  download: svg`<svg viewBox="0 0 24 24" class="i"><path d="M12 3v12M8 11l4 4 4-4M5 21h14"/></svg>`,
  folder: svg`<svg viewBox="0 0 24 24" class="i"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
  gear: svg`<svg viewBox="0 0 24 24" class="i"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.9 7.9 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 2.6h4l.4-2.6a8 8 0 0 0 1.7-1l2.4 1 2-3.4z"/></svg>`,
};

interface Settings { offset: number; autopause: boolean; vaultDir: string; theme: string; }
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
  @state() private settingsOpen = false;
  @state() private status = "";
  @state() private selectedId: string | null = null;

  private player: Player | null = null;
  private lastSaved = 0;
  private settings: Settings = loadSettings();

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && (this.searchOpen || this.settingsOpen)) { this.searchOpen = false; this.settingsOpen = false; return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.composedPath()[0] as HTMLElement)?.tagName ?? "");
    if (typing || this.searchOpen || this.settingsOpen) return;
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
    await api.upsertVideo(id, url ?? `https://youtu.be/${id}`);
    await this.refreshVideos();
    this.player?.load(id, this.current?.last_pos_secs ?? 0);
    await this.refreshNotes();
  }

  private addFromInput() {
    const input = this.renderRoot.querySelector("#url") as HTMLInputElement;
    const id = parseVideoId(input.value);
    if (!id) { this.flash("Not a valid YouTube URL"); return; }
    const raw = input.value.trim(); input.value = "";
    this.loadVideo(id, /^https?:/.test(raw) ? raw : `https://youtu.be/${id}`);
  }

  private capture() {
    if (!this.player || !this.currentId) return;
    const t = applyOffset(this.player.currentTime, this.settings.offset);
    if (this.settings.autopause) this.player.pause();
    this.editing = { t, draft: "" };
    this.updateComplete.then(() =>
      (this.renderRoot.querySelector("#editor textarea") as HTMLTextAreaElement)?.focus());
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

  private async runSearch(q: string) { this.searchResults = q.trim() ? await api.searchNotes(q) : []; }
  private async openHit(h: SearchHit) {
    this.searchOpen = false;
    await this.loadVideo(h.video_id);
    setTimeout(() => this.seek(h.t_secs), 900);
  }

  private async exportJson() { download("ytnt-backup.json", await api.exportJson(), "application/json"); this.flash("Exported backup"); }
  private async importJson(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await api.importJson(await file.text());
    await this.refreshVideos(); await this.refreshNotes();
    this.flash("Imported backup");
  }

  private mdForCurrent(): string | null {
    const v = this.current;
    if (!v || !this.notes.length) return null;
    return notesToMarkdown({ id: v.id, title: v.title, url: v.url }, this.notes);
  }
  private async copyMd() {
    const md = this.mdForCurrent(); if (!md) return;
    await navigator.clipboard.writeText(md); this.flash("Copied Markdown");
  }
  private downloadMd() {
    const md = this.mdForCurrent(); if (!md) return;
    download(`${this.currentSlug()}.md`, md, "text/markdown"); this.flash("Saved .md");
  }
  private currentSlug(): string {
    const v = this.current; if (!v) return "notes";
    return (v.title || v.id).replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || v.id;
  }
  private async saveToVault() {
    const md = this.mdForCurrent(); const dir = this.settings.vaultDir?.trim();
    if (!md || !dir) return;
    try { const path = await api.saveMarkdown(dir, `${this.currentSlug()}.md`, md); this.flash(`Saved → ${path}`); }
    catch (e) { this.flash(String(e)); }
  }

  private setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
    this.settings = { ...this.settings, [k]: v };
    localStorage.setItem("ytnt.settings", JSON.stringify(this.settings));
    if (k === "theme") document.documentElement.dataset.theme = String(v);
    this.requestUpdate();
  }
  private flash(m: string) { this.status = m; setTimeout(() => (this.status = ""), 2500); }
  private changeRate(d: number) {
    if (!this.player) return;
    const r = Math.min(3, Math.max(0.25, +(this.player.getRate() + d).toFixed(2)));
    this.player.setRate(r); this.flash(`Speed ${r}×`);
  }
  private onPlayerError(code: number) {
    const msg: Record<number, string> = {
      2: "Invalid video URL", 5: "Playback error", 100: "Video not found or removed",
      101: "Embedding disabled by the owner", 150: "Embedding disabled by the owner",
    };
    this.flash(msg[code] ?? "Player error");
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

  render() {
    const filtered = this.displayed();
    return html`
      <header class="titlebar" data-tauri-drag-region>
        <span class="tb-title" data-tauri-drag-region><span class="dot"></span> youtube-note-thing</span>
        <div class="tb-controls">
          <button class="tb-btn" title="Minimize" @click=${() => win()?.minimize()}>${I.min}</button>
          <button class="tb-btn" title="Maximize" @click=${() => win()?.toggleMaximize()}>${I.max}</button>
          <button class="tb-btn close" title="Close" @click=${() => win()?.close()}>${I.close}</button>
        </div>
      </header>

      <aside>
        <div class="label">Library</div>
        <div class="lib">
          ${this.videos.length ? this.videos.map((v) => html`
            <div class="libcard ${v.id === this.currentId ? "active" : ""}" @click=${() => this.loadVideo(v.id, v.url)}>
              <img class="thumb" loading="lazy" src=${`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                @error=${(e: Event) => ((e.target as HTMLElement).style.visibility = "hidden")} />
              <div class="meta">
                <div class="t" title=${v.title || v.id}>${v.title || v.id}</div>
                <div class="c">${v.note_count} ${v.note_count === 1 ? "note" : "notes"}</div>
              </div>
              <button class="ghost rm" title="Remove" @click=${(e: Event) => { e.stopPropagation(); this.removeVideo(v.id); }}>${I.close}</button>
            </div>`) : html`<div class="empty-lib">No videos yet — load one to start.</div>`}
        </div>
      </aside>

      <main>
        <div class="topbar">
          <input id="url" type="text" placeholder="Paste a YouTube URL or id…" autocomplete="off"
            @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this.addFromInput()} />
          <button class="primary" @click=${() => this.addFromInput()}>Load</button>
          <button class="ghost" title="Search all notes" @click=${() => { this.searchOpen = true; this.searchResults = []; }}>${I.search}</button>
          <button class="ghost" title="Settings" @click=${() => (this.settingsOpen = true)}>${I.gear}</button>
        </div>

        ${this.current ? html`<div class="nowplaying">
          <div class="np-main">
            <div class="np-title" title=${this.current.title || this.current.id}>${this.current.title || this.current.id}</div>
            <div class="np-meta">${this.current.channel || ""}${(this.dur || this.current.duration) ? html` · ${formatTime(this.dur || this.current.duration || 0)}` : nothing}</div>
          </div>
          <a class="np-link" @click=${() => window.open(`https://www.youtube.com/watch?v=${this.current!.id}`, "_blank")}>Open on YouTube ↗</a>
        </div>` : nothing}
        <div id="playerWrap"><div id="player"></div></div>
        <div id="timeline" title="click to seek" @click=${(e: MouseEvent) => this.timelineClick(e)}>
          <div id="progress"></div>
          ${this.dur ? this.notes.map((n) => html`<div class="marker" style="left:${(n.t_secs / this.dur) * 100}%"
            title=${`${formatTime(n.t_secs)} — ${n.content}`}
            @click=${(e: Event) => { e.stopPropagation(); this.seek(n.t_secs); }}></div>`) : nothing}
        </div>

        <div class="toolbar">
          <button class="primary" @click=${() => this.capture()} ?disabled=${!this.currentId}>${I.plus} Add note <span class="kbd">Alt+N</span></button>
          <input type="text" placeholder="Filter notes…" .value=${this.filter}
            @input=${(e: Event) => (this.filter = (e.target as HTMLInputElement).value)} />
          ${this.current?.manual_order ? html`<button @click=${() => this.resetOrder()}>By time</button>` : nothing}
          <button class="ghost" title="Copy notes as Markdown" ?disabled=${!this.notes.length} @click=${() => this.copyMd()}>${I.copy}</button>
          <button class="ghost" title="Download .md" ?disabled=${!this.notes.length} @click=${() => this.downloadMd()}>${I.download}</button>
          <button class="ghost" title=${this.settings.vaultDir ? "Save .md to vault folder" : "Set a vault folder in settings first"}
            ?disabled=${!this.notes.length || !this.settings.vaultDir} @click=${() => this.saveToVault()}>${I.folder}</button>
          <span class="status">${this.status}</span>
        </div>

        <div class="notes" @click=${(e: Event) => this.onNotesClick(e)}>
          ${!this.currentId ? html`<div class="empty">Load a video, then press <span class="kbd2">Alt&nbsp;+&nbsp;N</span> to capture a note at the current moment.</div>` : nothing}
          ${this.currentId && filtered.length === 0 && !this.editing ? html`<div class="empty">No notes yet.</div>` : nothing}
          ${this.editing && !this.editing.id ? this.renderEditor() : nothing}
          ${filtered.map((n) => (this.editing?.id === n.id ? this.renderEditor() : this.renderNote(n)))}
        </div>
      </main>

      ${this.searchOpen ? this.renderSearch() : nothing}
      ${this.settingsOpen ? this.renderSettings() : nothing}
    `;
  }

  private renderEditor() {
    const e = this.editing!;
    return html`<div id="editor" class="note">
      <span class="ts">${formatTime(e.t)}</span>
      <div class="grow">
        <textarea placeholder="Write a note… Markdown supported." .value=${e.draft}
          @keydown=${(ev: KeyboardEvent) => {
            if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); this.commit((ev.target as HTMLTextAreaElement).value); }
            else if (ev.key === "Escape") { ev.preventDefault(); this.cancel(); }
          }}></textarea>
        <div class="muted sm" style="margin-top:5px">Ctrl+Enter to save · Esc to cancel</div>
      </div>
    </div>`;
  }

  private renderNote(n: Note) {
    const canReorder = !this.filter;
    return html`<div class="note ${this.selectedId === n.id ? "selected" : ""}" @click=${() => (this.selectedId = n.id)}>
      <button class="ts" title="Jump to ${formatTime(n.t_secs)}" @click=${() => this.seek(n.t_secs)}>${formatTime(n.t_secs)}</button>
      <div class="grow body">${unsafeHTML(renderMarkdown(n.content))}</div>
      <div class="acts">
        ${canReorder ? html`
          <button class="ghost" title="Move up" @click=${() => this.move(n, -1)}>${I.up}</button>
          <button class="ghost" title="Move down" @click=${() => this.move(n, 1)}>${I.down}</button>` : nothing}
        <button class="ghost" title="Edit" @click=${() => this.edit(n)}>${I.edit}</button>
        <button class="ghost" title="Delete" @click=${() => this.del(n.id)}>${I.trash}</button>
      </div>
    </div>`;
  }

  private renderSearch() {
    return html`<div class="overlay" @click=${() => (this.searchOpen = false)}>
      <div class="panel" @click=${(e: Event) => e.stopPropagation()}>
        <div class="sbar">${I.search}<input type="text" placeholder="Search all notes…" autofocus
          @input=${(e: Event) => this.runSearch((e.target as HTMLInputElement).value)} /></div>
        <div class="results">
          ${this.searchResults.map((h) => html`<button class="hit" @click=${() => this.openHit(h)}>
            <span class="ts">${formatTime(h.t_secs)}</span>
            <span class="grow"><span class="htitle">${h.video_title || h.video_id}</span> — ${h.content}</span>
          </button>`)}
          ${this.searchResults.length === 0 ? html`<div class="muted sm" style="padding:8px">No matches.</div>` : nothing}
        </div>
      </div>
    </div>`;
  }

  private renderSettings() {
    return html`<div class="overlay" @click=${() => (this.settingsOpen = false)}>
      <div class="panel" @click=${(e: Event) => e.stopPropagation()}>
        <div class="panel-head"><span>Settings</span>
          <button class="ghost" title="Close" @click=${() => (this.settingsOpen = false)}>${I.close}</button></div>
        <label class="field"><span>Theme</span>
          <select @change=${(e: Event) => this.setSetting("theme", (e.target as HTMLSelectElement).value)}>
            ${THEMES.map((t) => html`<option value=${t} ?selected=${t === this.settings.theme}>${t}</option>`)}
          </select></label>
        <label class="field"><span>Auto-pause when adding a note</span>
          <input type="checkbox" .checked=${this.settings.autopause}
            @change=${(e: Event) => this.setSetting("autopause", (e.target as HTMLInputElement).checked)} /></label>
        <label class="field"><span>Capture offset (seconds before keypress)</span>
          <input type="number" min="0" max="30" .value=${String(this.settings.offset)}
            @input=${(e: Event) => this.setSetting("offset", Math.max(0, +(e.target as HTMLInputElement).value || 0))} /></label>
        <label class="field col"><span>Vault folder — for “Save to vault”</span>
          <input type="text" placeholder="C:\\Users\\you\\Vault" .value=${this.settings.vaultDir}
            @input=${(e: Event) => this.setSetting("vaultDir", (e.target as HTMLInputElement).value)} /></label>
        <div class="field col"><span>Library backup</span>
          <div class="row2">
            <button class="grow" @click=${() => this.exportJson()}>Export JSON</button>
            <label class="btn grow" style="justify-content:center">Import JSON
              <input type="file" accept="application/json" hidden @change=${(e: Event) => this.importJson(e)} /></label>
          </div></div>
        <div class="hint muted sm">Shortcuts: <b>Alt+N</b> note · <b>Space/K</b> play · <b>J/L</b> ±10s · <b>←/→</b> ±5s · <b>M</b> mute · <b>F</b> fullscreen · <b>0–9</b> seek · <b>↑/↓</b> select note</div>
      </div>
    </div>`;
  }

  static styles = css`
    :host {
      --r:10px; --r-sm:8px;
      --tint: color-mix(in srgb, var(--accent) 15%, transparent);
      --hover: color-mix(in srgb, var(--fg-default) 8%, transparent);
      display:grid; grid-template-columns:264px 1fr; grid-template-rows:32px minmax(0,1fr);
      height:100vh; background:var(--bg-deep); color:var(--fg-default);
      font:13.5px/1.55 "Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
      -webkit-font-smoothing:antialiased;
    }
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
    .tb-title .dot { width:9px; height:9px; border-radius:3px; background:var(--accent); box-shadow:0 0 10px color-mix(in srgb, var(--accent) 70%, transparent); }
    .tb-controls { display:flex; align-self:stretch; }
    .tb-btn { width:46px; border:none; border-radius:0; background:transparent; color:var(--fg-muted); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
    .tb-btn:hover { background:var(--hover); color:var(--fg-default); }
    .tb-btn.close:hover { background:var(--err); color:var(--bg-deep); }

    aside { background:var(--bg-surface); border-right:1px solid var(--border-subtle); display:flex; flex-direction:column; min-height:0; }
    .label { font-size:10.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--fg-faded); padding:14px 16px 6px; }
    .lib { flex:1; min-height:0; overflow:auto; padding:0 8px 8px; display:flex; flex-direction:column; gap:2px; }
    .libcard { display:flex; gap:9px; align-items:center; padding:6px; border-radius:var(--r-sm); cursor:pointer; position:relative; transition:background .12s; }
    .libcard:hover { background:var(--hover); }
    .libcard.active { background:var(--tint); box-shadow:inset 3px 0 0 var(--accent); }
    .libcard .thumb { width:58px; height:33px; border-radius:5px; object-fit:cover; background:#000; flex:0 0 auto; }
    .libcard .meta { min-width:0; flex:1; }
    .libcard .t { font-size:12.5px; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .libcard .c { font-size:11px; color:var(--fg-faded); margin-top:1px; }
    .libcard .rm { opacity:0; position:absolute; top:5px; right:5px; padding:3px; }
    .libcard:hover .rm { opacity:.65; } .libcard .rm:hover { opacity:1; }
    .empty-lib { color:var(--fg-faded); font-size:12px; padding:6px 16px; }

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
    .topbar { display:flex; gap:8px; }
    .topbar input { flex:1; }
    .nowplaying { display:flex; align-items:center; gap:12px; }
    .np-main { flex:1; min-width:0; }
    .np-title { font-weight:650; font-size:15.5px; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .np-meta { font-size:12px; color:var(--fg-faded); margin-top:1px; }
    .np-link { color:var(--fg-muted); font-size:12px; cursor:pointer; flex:0 0 auto; }
    .np-link:hover { color:var(--accent); }
    #playerWrap { position:relative; background:#000; border:1px solid var(--border-subtle); border-radius:var(--r); overflow:hidden; aspect-ratio:16/9; max-height:46vh; flex:0 0 auto; box-shadow:0 10px 34px rgba(0,0,0,.45); }
    #player { width:100%; height:100%; }
    #timeline { position:relative; height:10px; background:var(--bg-elevated); border-radius:99px; cursor:pointer; flex:0 0 auto; margin:2px 0; }
    #progress { position:absolute; inset:0 100% 0 0; background:linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent), white 22%)); border-radius:99px; }
    .marker { position:absolute; top:-3px; width:3px; height:16px; background:var(--accent); border-radius:2px; transform:translateX(-50%); box-shadow:0 0 0 2px var(--bg-deep); }
    .marker:hover { width:5px; }
    .toolbar { display:flex; gap:8px; align-items:center; }
    .toolbar input { flex:1; }
    .kbd { font-size:11px; color:color-mix(in srgb, var(--accent-fg) 72%, transparent); font-weight:600; padding-left:2px; }
    .status { color:var(--fg-muted); font-size:12px; white-space:nowrap; }

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
    .empty { margin:auto; text-align:center; color:var(--fg-faded); max-width:300px; line-height:1.7; }
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
    .hint { border-top:1px solid var(--border-subtle); padding-top:10px; line-height:1.7; }
    .hint b { color:var(--fg-default); font-weight:600; }
    .sbar { display:flex; align-items:center; gap:8px; background:var(--bg-deep); border:1px solid var(--border); border-radius:var(--r-sm); padding:0 11px; color:var(--fg-muted); }
    .sbar input { flex:1; background:transparent; border:none; padding:10px 0; }
    .sbar input:focus-visible { outline:none; }
    .results { overflow:auto; display:flex; flex-direction:column; gap:3px; }
    .hit { display:flex; gap:10px; text-align:left; align-items:baseline; background:transparent; border:1px solid transparent; border-radius:var(--r-sm); padding:9px 10px; width:100%; }
    .hit:hover { background:var(--hover); }
    .hit .htitle { font-weight:600; }
  `;
}

function loadSettings(): Settings {
  const def: Settings = { offset: 3, autopause: true, vaultDir: "", theme: "catppuccin-mocha" };
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
