# Architecture

## Principle: a small core with a seam

The app is a **standalone note-taker** with one well-defined extension point. Everything that can be
done locally and reliably lives in the core. Everything fragile or heavy (transcription, semantic
search, RAG, fancy PKM export) lives *behind an integration seam* and is optional.

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri v2 Desktop Shell                     │
│  ┌────────────────────────┐   ┌──────────────────────────┐   │
│  │   WebView (Frontend)    │   │     Rust Backend          │   │
│  │  Lit + CodeMirror       │◄─►│  Tauri commands (IPC)     │   │
│  │  YouTube IFrame player  │   │  SQLite via sqlx, FTS5    │   │
│  │  reactive stores        │   │  Markdown export          │   │
│  │  scoped CSS             │   │  Integration dispatch ────┼───┼──► optional
│  └────────────────────────┘   └──────────────────────────┘   │     integrations
└─────────────────────────────────────────────────────────────┘    (Phoneme, …)
```

The core has **zero hard dependency** on any integration. With nothing installed, you still get the
player, notes, library, search, and Markdown/Obsidian export.

## Frontend (Lit + CodeMirror — matches Phoneme)

### State: reactive stores, with video time kept OUT of reactive state

The player time polls ~4×/s; if that drove a reactive property it would update every observer on every
tick. So:

- **Reactive state only for what changes on user action** — notes, library, settings — via Lit reactive
  controllers (or the small store pattern Phoneme already uses), so a component re-renders only when its
  slice changes.
- **Current video time is a plain field, not reactive state.** The player wrapper polls
  `getCurrentTime()` into a plain variable — no reactive update, no re-render. When the user presses the
  capture key, the timestamp is read from it *once*. The custom timeline reads it on its own
  `requestAnimationFrame` loop, mutating only its own DOM.

This single decision keeps capture latency low and the UI quiet — it's the one piece of the original
plan worth keeping verbatim.

### Component tree (lean)

```
App
├── TitleBar
├── Sidebar — VideoLibrary (search + tags)
├── MainArea
│   ├── VideoPlayer (IFrame) + MarkerTimeline (custom seek bar with note dots)
│   └── NotePanel — NoteToolbar, NoteList (virtualized >100), NoteEditor
│   └── EmptyState
├── SearchOverlay (global note search)
├── ExportDialog
├── IntegrationsPanel (only shows integrations that are present)
└── Settings
```

## Backend (Rust)

### SQLite via sqlx (not tauri-plugin-sql, not rusqlite)

DB access stays in Rust, inside Tauri command handlers. Every DB op already crosses the Tauri IPC
boundary as a command; routing SQL from JS would add a second hop and scatter transaction boundaries.
Use **`sqlx`** (sqlite + migrate features) with **WAL mode** — not rusqlite — specifically so we can
lift Phoneme's existing catalog layer (`phoneme-core/catalog/`, `backup.rs`, the migration runner)
instead of re-typing it. See [Reuse from Phoneme](#reuse-from-phoneme).

### Command surface (core)

```rust
// Library
fn add_video(url: String) -> Result<Video, String>          // resolves metadata via oEmbed, see below
fn get_videos() -> Result<Vec<VideoWithNoteCount>, String>
fn delete_video(id: String) -> Result<(), String>

// Notes
fn create_note(video_id: String, t_secs: f64, content: String) -> Result<Note, String>
fn update_note(id: String, content: String) -> Result<Note, String>
fn delete_note(id: String) -> Result<(), String>
fn get_notes(video_id: String) -> Result<Vec<Note>, String>
fn search_notes(query: String) -> Result<Vec<NoteSearchResult>, String>  // FTS5

// Export + integrations
fn export_markdown(video_id: String, opts: ExportOpts) -> Result<String, String>
fn list_integrations() -> Result<Vec<IntegrationInfo>, String>           // which are present
fn dispatch_integration(id: String, action: IntegrationAction) -> Result<Value, String>

// Settings
fn get_settings() -> Result<Settings, String>
fn update_settings(s: Settings) -> Result<(), String>
```

Every command returns `Result<T, String>`; the frontend `try/catch`es each `invoke` and routes the
message to a toast/banner. No `alert()`, no silent failures.

### Metadata without an API key

The original plan required a YouTube Data API key (Google Cloud project) just to show a title. Skip it:
`https://www.youtube.com/oembed?url=<video-url>&format=json` returns title, author, and thumbnail with
**no key and no quota**. The Data API is only needed for search/playlist import — defer to a later phase
and make the key optional even then.

## Reuse from Phoneme

You already built the hard ~60% of a Tauri desktop app in Phoneme. This app should **fork the
skeleton**, not re-derive it. Liftable with little or no change:

- **Tauri v2 setup + the vetted plugin set:** `shell` (to run `phoneme import`), `global-shortcut`
  (the capture key), `dialog`, `fs`, `window-state`, `updater`.
- **DB & infra:** `phoneme-core/catalog/` (SQLite + FTS5 + migrations), `backup.rs` (backup-on-launch +
  restore), `config.rs` (TOML config), `secrets.rs`/`secret_crypto.rs` (encrypted integration tokens —
  this is where optional Obsidian/Notion keys go), `error.rs`, `id.rs`, `export.rs`, `tags.rs`.
- **CI & distribution:** the `ci.yml`/`release.yml` workflows, the WiX installer fragment, code-signing,
  the icon pipeline (`generate-icons.ps1`, `icon-source.svg`).
- **Editor:** Phoneme's CodeMirror 6 (+ vim mode) setup, reused for the markdown note editor.

Delete, don't port: everything audio (`phoneme-audio`, whisper/diarization/voiceprint/llm,
cpal/hound/rubato). This app has no audio.

> **Frontend framework — decided: Lit + CodeMirror, matching Phoneme.** Reuse over rebuild: inherit
> Phoneme's editor, build config, scoped-CSS styling, and component patterns; lighter runtime;
> one mental model across both apps for a solo maintainer. (React + shadcn/ui was the alternative — it
> only wins if maximizing outside contributors becomes the explicit goal.)

## Data model

Three tables. That's the whole schema.

```sql
CREATE TABLE videos (
    id           TEXT PRIMARY KEY,   -- YouTube video id
    title        TEXT NOT NULL,
    channel      TEXT,
    thumbnail    TEXT,
    duration     INTEGER,            -- seconds (filled when known)
    url          TEXT NOT NULL,
    added_at     TEXT NOT NULL DEFAULT (datetime('now')),
    last_watched TEXT,
    last_pos_secs REAL,             -- resume where you left off (borrowed from Obsidian Media Notes)
    -- Optional link to an integration's record (e.g. a Phoneme recording id).
    -- Generic on purpose: one nullable pointer, not an integration-specific column.
    ext_ref      TEXT                -- JSON: {"integration":"phoneme","ref":"rec_..."} or NULL
);

CREATE TABLE notes (
    id          TEXT PRIMARY KEY,    -- UUID
    video_id    TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    t_secs      REAL NOT NULL,       -- exact second, e.g. 33.5
    content     TEXT NOT NULL DEFAULT '',  -- markdown
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_notes_video_t ON notes(video_id, t_secs);

CREATE VIRTUAL TABLE notes_fts USING fts5(content, content='notes', content_rowid='rowid');
-- + the three standard AI/AD/AU sync triggers.

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- JSON values
```

Notes vs the original schema, deliberately cut:
- **No `pkm_destinations` table** — export status is transient UI, not persistent state. Integrations
  that need their own tracking own it on their side (Phoneme already does).
- **No transcript / chapter / tag-suggestion storage** — that's the integration's data, fetched live,
  not duplicated here.
- **No `screenshot_path`** — see constraints.
- **Tags**: start with a `tags` JSON column on `videos` only. Promote to a join table *if* tag search
  across thousands of videos ever proves slow. Two tables don't need normalized tags on day one.

### Migrations

A `_migrations(version, applied_at)` table and numbered `NNN_*.sql` files applied in order at startup,
each in a transaction. That's it. **No SHA-256 checksums, no duration tracking** — that was solving
problems a three-table local DB doesn't have. Back up the DB file before applying a migration; keep the
last few copies.

## The integration seam

Integrations are discovered at runtime and never required. The contract is intentionally tiny — see
[INTEGRATIONS.md](INTEGRATIONS.md) for the full interface and the Phoneme adapter. In short:

- The backend probes for each known integration (e.g. is the Phoneme daemon/REST up?) and reports
  presence via `list_integrations`.
- The frontend renders integration UI **only when present**, behind feature flags.
- All calls go through `dispatch_integration`, so the core never imports an integration's types.

This is the one abstraction the app is allowed, because extensibility is a product requirement, not
speculation. It stays a single dispatch function with a `match`, not a plugin framework, until a real
second integration proves more is needed.

## Player integration notes

The YouTube IFrame Player API needs specific setup inside a Tauri webview:

- **`enablejsapi=1`** to control play/pause/seek.
- **`origin`** matching the app origin (`tauri://localhost` / `https://tauri.localhost`) to dodge
  Error 153 in some embed-restricted contexts.
- **`playsinline=1`**, **`rel=0`**.
- **Embed restriction (Error 153):** some videos can't be embedded. Detect on load, show an "Open in
  browser" fallback (`open::that()`), keep the note panel usable.

### Marker timeline

The IFrame API does not expose its native seek-bar DOM, so note markers can't overlay YouTube's bar.
Render a **custom `<input type="range">` below the player** with absolutely-positioned marker dots;
progress is driven by the time ref, clicks call `player.seekTo()`. (This was correct in the original
plan and stays.)

### Note rendering (XSS-safe)

Note content is Markdown stored as text. Render with `markdown-it` (or `marked`) → **`DOMPurify`** before
it touches the DOM. Never insert un-sanitized HTML.

## Security / privacy

- Local-only by default; no telemetry, no analytics, no remote logging.
- No account. The only secrets are *optional* integration tokens (e.g. an Obsidian REST key); store
  those in the OS keychain via `tauri-plugin-store`, never in the SQLite file.
- CSP allows the YouTube player origins and oEmbed only:

```
default-src 'self';
frame-src https://www.youtube.com https://www.youtube-nocookie.com;
img-src 'self' https://i.ytimg.com https://img.youtube.com data:;
script-src 'self' 'unsafe-eval' https://www.youtube.com;
connect-src 'self' https://www.youtube.com http://127.0.0.1:*;   -- 127.0.0.1 for local integrations
```

## Honest constraints (don't design around fiction)

- **Ads:** the embedded IFrame player serves ads. There is no ad-free embed. The app does not and
  cannot strip them.
- **Screenshots:** the player is a **cross-origin iframe**; its video frames cannot be drawn to a
  canvas (the canvas taints, `toDataURL` throws). The original "canvas or FFmpeg" plan is impossible.
  If screenshots are ever built, the only path is OS window-region capture (Tauri can do this) — a
  best-effort, separate feature, explicitly not frame-accurate. Cut from v1.
- **Transcripts:** standalone, surface YouTube's own caption track when present (best-effort, fragile —
  YouTube changes it). Reliable transcription is an integration (Phoneme downloads + Whispers it).

## Error handling

Three tiers, no crashes on recoverable errors:

| Tier | Examples | Handling |
|------|----------|----------|
| Recoverable | oEmbed fetch fail, integration offline, export retry | inline banner / toast; retry on next interaction |
| Disruptive | SQLite write fail, player load fail, invalid URL | blocking message for that action; app survives |
| Fatal | DB corruption with no backup, can't create app dir | clear message + restore-from-backup or start-fresh |

Specifics worth fixing up front: invalid-URL inline validation; private/deleted-video message;
Error 153 → open-in-browser; `PRAGMA integrity_check` on startup with auto-restore from the newest
backup. Guard each major UI region so a render error in one panel can't blank the whole app — catch in
the component/controller and show a fallback, plus a top-level `window.onerror`/`unhandledrejection`
handler. Log to a rotating JSON-lines file under the app data dir (no PII, no tokens).
