# Architecture overview

This is the day-one read for working on **youtube-note-thing** (ytnt). It traces a YouTube note from the moment you paste a URL to the moment you find it again with full-text search, names every component along the way, and points at the file that owns each behavior. The deeper docs pick up where this one stops — this page links into them rather than restating them.

ytnt is a **local-first desktop app for timestamped notes on YouTube videos**. The backend is **Rust** (Tauri 2), the frontend is **TypeScript** (one Lit 3 web component), and the store is **SQLite via sqlx**. Everything lives on your machine; the only network calls are to YouTube itself and to two *optional* integrations — Phoneme (local transcription) and your own Google/YouTube account.

## Where each subsystem is documented

- **Build, prerequisites, dev vs. release** — [building_from_source.md](building_from_source.md).
- **The frontend** (the Lit component, state, rendering, the player wrapper, helpers) — [frontend_guide.md](frontend_guide.md).
- **The backend** (the Tauri command surface, the SQLite layer) — [backend_guide.md](backend_guide.md).
- **Schema, the FTS index, and the migration rules** — [data_model_and_migrations.md](data_model_and_migrations.md).
- **Phoneme and Google integrations in depth** — [integrations.md](integrations.md).
- **Tests, gates, and the pre-PR checklist** — [testing_and_verification.md](testing_and_verification.md).
- **Adding a feature end-to-end** — [how_to_extend.md](how_to_extend.md).
- For what each feature *does* from a user's seat, the [user guide](../user-guide/getting_started.md) is the companion to this developer set.

The code is the source of truth. Module-level doc comments in [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) and [`src-tauri/src/db.rs`](../../src-tauri/src/db.rs), and the inline comments throughout [`src/app.ts`](../../src/app.ts), are canonical; this prose is a map, not a substitute.

## 1. The process model

ytnt is a single Tauri 2 application: two halves in one process tree, talking over Tauri's IPC bridge.

```text
┌─────────────────────────────────────────────────────────────┐
│  Tauri app (one window)                                      │
│                                                              │
│   ┌───────────────────────┐      ┌───────────────────────┐  │
│   │  WebView (frontend)    │      │  Rust core (backend)  │  │
│   │  Vite-built bundle     │      │  src-tauri/src        │  │
│   │                        │      │                       │  │
│   │  <ytnt-app>  ──invoke──┼─IPC──┼─▶ #[tauri::command]   │  │
│   │  (one Lit component)   │      │      fns               │  │
│   │                        │◀─────┼── results / events    │  │
│   │  YouTube IFrame ◀──────┼──┐   │                       │  │
│   │  (embedded player)     │  │   │   Db (sqlx pool) ─────┼──┼─▶ ytnt.db (SQLite)
│   └───────────────────────┘  │   │   resolve_phoneme() ──┼──┼─▶ phoneme CLI / REST / pipe
│                              http │   Google OAuth ───────┼──┼─▶ YouTube Data API
│                       youtube.com │                       │  │
│                                   └───────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Why split it this way.** The frontend is a webview because the heart of the app is an embedded **YouTube IFrame player**, which only runs in a browser context. The backend is Rust because that is where the durable store lives (SQLite), where we shell out to other processes (the Phoneme CLI), and where we make HTTP calls without webview CORS limits (YouTube's InnerTube endpoints, the Google Data API, Phoneme's REST). The IPC bridge is the only seam between them, and it is **strongly typed on both ends** (section 3).

| Half | Owns | Entry point |
| --- | --- | --- |
| WebView (frontend) | UI, all interaction, the embedded player, localStorage settings, tag-color/membership merge | [`src/main.ts`](../../src/main.ts) → [`src/app.ts`](../../src/app.ts) |
| Rust core (backend) | SQLite store, the command surface, Phoneme/Google/YouTube I/O, OAuth loopback | [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) → `run()` |

The bundle identifier is `dev.ytnt.app` (see [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json)); the database and OAuth tokens live under `%APPDATA%/dev.ytnt.app/`. In dev, Vite serves the frontend on **port 5191** (`strictPort`). See [data_model_and_migrations.md](data_model_and_migrations.md) for the on-disk layout and [building_from_source.md](building_from_source.md) for how the two halves are launched together.

## 2. The single Lit component

The whole frontend is **one custom element**, `<ytnt-app>`, defined in [`src/app.ts`](../../src/app.ts). There is no router and no component tree — state is `@state()` fields on the class, and `render()` returns the entire UI as one Lit template. The supporting modules are deliberately thin:

| Module | Role |
| --- | --- |
| [`src/app.ts`](../../src/app.ts) | The `<ytnt-app>` component: all state, event handlers, and `render()` |
| [`src/api.ts`](../../src/api.ts) | Typed `invoke()` wrappers — the **frontend's view of the command surface** |
| [`src/lib.ts`](../../src/lib.ts) | Pure helpers (URL parsing, time formatting, the tag merge, Markdown export) — no DOM, unit-tested |
| [`src/player.ts`](../../src/player.ts) | A thin wrapper over the YouTube IFrame Player API |
| [`src/markdown.ts`](../../src/markdown.ts) | Minimal Markdown rendering for note display |
| [`src/main.ts`](../../src/main.ts) | Bootstraps fonts/theme and imports the component |

**Invariant: pure helpers stay pure.** Everything in `src/lib.ts` is testable without a DOM or a Tauri runtime — that is what `src/lib.test.ts` exercises. Anything that touches the player, the backend, or `localStorage` belongs in `src/app.ts`.

**The player is a ref, not state.** `Player.currentTime` is polled ~4×/second (250 ms) and is a *plain field*, never reactive `@state` — otherwise every tick would re-render the component. The app reads `player.currentTime` only when it needs it (e.g. capturing a note). See the comment at the top of [`src/player.ts`](../../src/player.ts).

**Keyboard focus is reclaimed from the iframe on purpose.** The YouTube iframe steals focus on click, so `onFocusIn` blurs it on the next frame; all transport shortcuts drive the player through its JS API, so they fire whether or not the iframe has focus. The frontend internals are covered in [frontend_guide.md](frontend_guide.md).

## 3. The typed command bridge

The frontend never calls Tauri's `invoke()` directly with stringly-typed names. Instead, [`src/api.ts`](../../src/api.ts) exports an `api` object whose every method wraps one `#[tauri::command]` in [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs):

```text
src/app.ts            src/api.ts                       src-tauri/src/lib.rs
─────────             ──────────                       ────────────────────
api.createNote(...) → invoke("create_note", {...}) ─▶ #[tauri::command]
                                                       async fn create_note(...) ─▶ Db::create_note
```

The wrappers carry the request and response **TypeScript interfaces** (`VideoWithCount`, `Note`, `SearchHit`, `Segment`, `PhonemeRec`, …) that mirror the Rust `Serialize` structs in `lib.rs`/`db.rs`. Tauri maps camelCase JS argument keys to snake_case Rust parameters automatically, so `videoId` in `api.ts` reaches `video_id` in Rust.

**Adding a command means editing in lockstep**: the Rust `#[tauri::command]` fn, its entry in the `generate_handler!` list at the bottom of `run()`, and a typed wrapper in `api.ts`. Forget the handler-list entry and the call fails at runtime; forget the wrapper and the type checker won't help you. The full surface is enumerated in [backend_guide.md](backend_guide.md), and the walkthrough for wiring a new one end-to-end is in [how_to_extend.md](how_to_extend.md).

## 4. The data layer

[`src-tauri/src/db.rs`](../../src-tauri/src/db.rs) is the only code that touches SQLite. It holds a `Db { pool: SqlitePool }` managed by Tauri (`app.manage(db)`), opened in `run()` with WAL journaling, foreign keys on, and `create_if_missing`. On startup, `sqlx::migrate!("./migrations")` applies every migration in [`src-tauri/migrations/`](../../src-tauri/migrations) (`001_init` … `006_video_meta`).

All queries are **runtime queries** (`sqlx::query`/`query_as`), not the compile-time-checked macros — so no `DATABASE_URL` is needed at build time. The store is small:

| Table / index | Purpose |
| --- | --- |
| `videos` | One row per YouTube video: id, title, channel, url, duration, resume position (`last_pos_secs`), `manual_order`, `tags` (JSON array), `ext_ref` (integration link), `pinned`, `view_count`, `published_at` |
| `notes` | Timestamped notes (`t_secs`, `content`, `order_index`), cascade-deleted with their video |
| `notes_fts` | FTS5 full-text index over `notes.content`, kept in sync by insert/update/delete triggers |
| `playlist_items` | Cached membership of synced YouTube playlists (so the app can browse them and knows the `item_id` needed to remove an entry) |

**Migration gotcha — committed migrations are immutable.** sqlx checksums each migration *by its file bytes*. Editing a committed file (even a comment, even a CRLF/LF flip) breaks every existing database with `Migrate(VersionMismatch)`. `.gitattributes` marks `src-tauri/migrations/*.sql` as `-text` (git treats them as binary for line endings), so git never normalizes or converts their endings — the committed bytes, and therefore the sqlx checksums, stay stable. **To change the schema, add a new migration file — never edit an old one.** The full schema, the FTS trigger mechanics, and this rule in detail are in [data_model_and_migrations.md](data_model_and_migrations.md).

## 5. The optional integration adapters

Two integrations sit behind the same principle: **best-effort, never required**. If the dependency is absent, the feature greys out and the rest of the app works unchanged. Neither is bundled.

### 5.1 Phoneme (local transcription) — Phoneme is the authority

Phoneme is a sibling local transcription app. ytnt links a video to a Phoneme recording by storing a self-describing reference in `videos.ext_ref` as JSON: `{"integration":"phoneme","ref":"<id>"}` (parsed/serialized by `parseRef`/`serializeRef` in [`src/lib.ts`](../../src/lib.ts); legacy bare-id strings are still understood).

The backend locates the binary with **`resolve_phoneme()`** in `lib.rs`, in priority order: the Settings/`set_phoneme_bin` override → the `PHONEME_BIN` env var → `PATH` → a `cargo install` → the usual local dev build. It is **CLI-first with fallbacks**:

- **CLI** (`run_phoneme`) backs almost everything: probe/version, import, segments, chapters, search, tag list/attach/detach.
- **REST** (`phoneme-rest`, loopback `127.0.0.1:3737`, opt-in) provides live SSE pipeline progress (`phoneme_sse_start` bridges it to a Tauri `phoneme-event`) and is one source for transcript versions.
- **Daemon named pipe** (Windows-only) is the last-resort source for transcript versions.

**Invariants:**
- **Phoneme is the tag-catalog authority.** ytnt mirrors Phoneme's tag colors and never holds its own catalog or daemon.
- **Tag membership is a 3-way merge, bidirectional, no daemon in ytnt.** `mergeTagSets` in [`src/lib.ts`](../../src/lib.ts) reconciles ytnt's tags, Phoneme's tags, and a per-video **base snapshot** kept in `localStorage` (`ytnt.tagSyncBase`). The snapshot doubles as a durable queue: edits made while Phoneme is down are pushed on the next reconcile. First sync (no base) is a union — history is never assumed, so a tag is never wrongly deleted.
- **"Couldn't reach Phoneme" ≠ "no tags".** `phoneme_tags_for` returns `Err` (not an empty list) when the daemon is unreachable, so the frontend never detaches everything by mistake.
- **A too-old Phoneme degrades loudly.** `phoneme_probe` reports `present` / `daemon_ok` / `version` / `compatible` against `MIN_PHONEME_VERSION`; the frontend polls it every 15 s so a daemon that starts or dies mid-session flips live.

**CLI/REST parity** is the recurring theme: the same recording data is reachable through more than one transport, and the adapter prefers the most universally available one (CLI) before the opt-in or OS-specific ones. The full command-to-CLI mapping is in [integrations.md](integrations.md); the user-facing side is [phoneme_integration.md](../user-guide/phoneme_integration.md).

### 5.2 Google / YouTube account

Connecting a Google account is also optional. The backend runs the standard **installed-app loopback OAuth** flow (`google_connect` in `lib.rs`): bind a random `127.0.0.1` port with a `TcpListener`, open the consent page in the browser, capture the redirected `code`, exchange it for tokens, and persist them under the app data dir (`google_tokens.json`). The scope is the full `youtube` scope (read **and** write).

The app's own OAuth client is compiled in via `build.rs`/`option_env!("YTNT_GOOGLE_CLIENT_ID"/"_SECRET")` read from a gitignored `.env` (see `.env.example`); a user can also supply their own client id/secret in Settings. With an account connected, ytnt uses `videos.list` to backfill library-card metadata (channel, views, duration, publish date) and `playlistItems` to browse playlists and add/remove videos. Watch Later and History are not exposed by the API. Details and quotas: [integrations.md](integrations.md); the user flow: [youtube_account_and_playlists.md](../user-guide/youtube_account_and_playlists.md).

## 6. Life of a video

Adding a video, traced through every hop:

1. **Paste a URL** into the add field. `addFromInput` in `app.ts` runs it through `parsePlaylistId` then `parseVideoId` ([`src/lib.ts`](../../src/lib.ts)). A playlist URL imports the whole list (`import_youtube_playlist`, via YouTube's no-auth InnerTube `browse` endpoint); a video URL calls `loadVideo`.
2. **Persist** — `loadVideo` calls `upsert_video` (`INSERT … ON CONFLICT DO NOTHING`), so the row exists exactly once.
3. **Play** — `Player.load` cues the YouTube iframe at the saved `last_pos_secs` (it *cues*, not autoplays, so switching videos doesn't start playback).
4. **Backfill metadata** — `syncMissingMeta` asks `sync_video_meta` (YouTube Data API, batched 50 ids/call) to fill channel/views/duration/date for any video missing them. No-op if Google isn't connected.
5. **Reconcile tags** — `reconcileVideoTags` runs the Phoneme 3-way merge for this video (no-op if unlinked or Phoneme is down).
6. **Title capture** — when the player reports the video's title and the row has none, `set_video_title` saves it.
7. **Resume tracking** — the 250 ms tick calls `set_last_pos` (throttled to ~3 s of movement), so reopening the video resumes where you left off.

The video now appears as a **library card** (channel, views, publish date, duration, note count, tags) in the middle pane.

## 7. Life of a note — the canonical spine

This is the path to follow if you only read one flow:

1. **Capture** — press **Alt+N** (or the capture button). `capture()` reads `player.currentTime`, subtracts the configured **offset** (`applyOffset` — you usually want the note attached a few seconds before you reacted), and optionally **auto-pauses**. In our fullscreen mode the notes pane is hidden, so capture opens an overlay inside `#playerWrap` instead.
2. **Edit** — an inline editor opens with the timestamp fixed; you type the note body.
3. **Save** — `commit()` calls `create_note` (or `update_note` when editing). `Db::create_note` ([`src-tauri/src/db.rs`](../../src-tauri/src/db.rs)) inserts the row with a UUID and the next `order_index`.
4. **Index** — the `notes_ai` trigger mirrors the new content into `notes_fts` automatically. No application code indexes anything.
5. **Display** — `refreshNotes` reloads the list; notes sort by time, unless the video is in **manual order** (after a drag/reorder), in which case `order_index` wins.
6. **Find again** — open search (**`/`**). `runSearch` calls `search_notes`; `Db::search_notes` quotes each term and runs an FTS5 `MATCH` (ranked, top 50). If Phoneme is reachable, the same query also hits `phoneme_search` and merges those hits. Selecting a hit calls `loadVideo` and seeks to the note's timestamp.
7. **Export** — `notesToMarkdown` ([`src/lib.ts`](../../src/lib.ts)) renders one video's notes as Markdown with clickable `youtu.be?t=` timestamp links, copied, downloaded, or written to a vault folder via `save_markdown`.

## 8. The 3-pane UI

`render()` in [`src/app.ts`](../../src/app.ts) lays out three panes left to right:

```text
┌──────────────┬─────────────────────┬──────────────────────────────┐
│  .sidebar    │  .list              │  .detail                     │
│              │                     │                              │
│  Filters:    │  Library cards:     │  #playerWrap (embedded YT)   │
│   All        │   thumbnail-ish     │    └ fullscreen + Alt+N       │
│   Has-       │   title, channel,   │      note overlay            │
│   transcript │   views, date,      │                              │
│   Untagged   │   duration, tags    │  Notes  /  Transcript        │
│   Tagged     │   note count        │   (timestamped notes list,   │
│   By tag …   │   pin / select      │    or transcript / chapters  │
│   Playlists  │                     │    / compare / summary)      │
└──────────────┴─────────────────────┴──────────────────────────────┘
```

- **Left (`.sidebar`)** — filters: `all`, `has-transcript`, `untagged`, `tagged`, and one entry per tag (`tagFilter`), plus connected-account playlists. Toggle with **Ctrl/Cmd+B**.
- **Middle (`.list`)** — the library cards. Pin a video, shift-click to multi-select, then bulk-tag or bulk-delete. Card metadata is shown without covering the title.
- **Right (`.detail`)** — the embedded player in `#playerWrap`, with a **Notes** view and (when linked to Phoneme) a **Transcript** view that further switches between transcript / chapters / compare-versions / summary. Fullscreen fullscreens `#playerWrap` so the in-fullscreen note overlay can render on top.

Modals (search, settings, Tag Manager, find & replace, the shortcut cheat sheet) overlay the panes with a focus trap. The full keyboard map is the source of truth in `onKey` (`app.ts`) and is documented for users in [keyboard_shortcuts.md](../user-guide/keyboard_shortcuts.md).

## 9. Settings and other state outside SQLite

Not everything is in the database. App settings live in the browser's `localStorage` under `ytnt.settings`, loaded by `loadSettings()` in `app.ts` (defaults: offset `3`, autopause on, dark `catppuccin-mocha`, sync-tags on):

| Field | What it controls |
| --- | --- |
| `offset` | Seconds subtracted from the playhead when capturing a note |
| `autopause` | Pause the video while a note is being written |
| `vaultDir` | Folder for Markdown export (`save_markdown`) |
| `theme` | One of the Catppuccin / Tokyo Night / Dracula / Nord / Gruvbox / … themes |
| `stripTitlebar` | Hide the system titlebar (`setDecorations`) |
| `gClientId` / `gClientSecret` | Optional user-supplied Google OAuth client |
| `hiddenPlaylists` | Playlists hidden from the sidebar |
| `phonemeBin` | Explicit path to the Phoneme CLI (pushed to `set_phoneme_bin`) |
| `syncTags` | Enable bidirectional tag-membership sync with Phoneme |

Two more `localStorage` keys back the tag system: `ytnt.tagColors` (local color overrides that win over Phoneme's) and `ytnt.tagSyncBase` (the per-video base snapshot for the 3-way merge). The full settings reference for users is [settings_reference.md](../user-guide/settings_reference.md).

## Where to go next

- Setting up your machine → [building_from_source.md](building_from_source.md)
- Working in the frontend → [frontend_guide.md](frontend_guide.md)
- Working in the backend → [backend_guide.md](backend_guide.md)
- Schema and migrations → [data_model_and_migrations.md](data_model_and_migrations.md)
- The integration internals → [integrations.md](integrations.md)
- Running the gates before a PR → [testing_and_verification.md](testing_and_verification.md)
- Adding a feature → [how_to_extend.md](how_to_extend.md)
