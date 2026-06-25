# Backend Guide — the Tauri/Rust side

The backend is **Rust**, the frontend **TypeScript** (one Lit component), and
the wrapper **Tauri 2**. There is no daemon and no catalog process: the whole
backend is the Tauri app itself, holding a single SQLite connection pool and
exposing a small `#[tauri::command]` surface to the frontend over Tauri's
`invoke` bridge. Phoneme is an *optional* sibling reached by shelling out to its
CLI (with REST and named-pipe fallbacks) — see
[integrations.md](integrations.md).

This guide is the map of that surface: what the commands are, how they're
registered, how errors and state flow, and how to add a new one end to end. For
the runtime journey of a note read [architecture.md](architecture.md); for the
schema and migration rules read
[data_model_and_migrations.md](data_model_and_migrations.md); for the frontend
that calls these commands read [frontend_guide.md](frontend_guide.md).

The backend is three files under `src-tauri/src/`:

| File | Owns |
| :--- | :--- |
| [`main.rs`](../../src-tauri/src/main.rs) | The binary entry point. Sets `windows_subsystem = "windows"` in release (no console window) and calls `ytnt_lib::run()`. That's all it does. |
| [`lib.rs`](../../src-tauri/src/lib.rs) | Every `#[tauri::command]`, the Tauri builder/setup, handler registration, the Phoneme/Google/YouTube helpers, and the `err` error helper. |
| [`db.rs`](../../src-tauri/src/db.rs) | The SQLite layer: the `Db` pool wrapper, the `FromRow` structs, and one method per query. |

Module-level `//!` doc comments at the top of `lib.rs` and `db.rs` are the
canonical reference for intent; this guide is the companion, not a duplicate.

---

## 1. The command surface

A `#[tauri::command]` is a Rust function the frontend can call by name through
`invoke`. The TypeScript wrappers in [`src/api.ts`](../../src/api.ts) are the
typed mirror of this list — every command has exactly one entry there, and
**Tauri maps camelCase JS argument keys to snake_case Rust parameters
automatically** (e.g. `videoId` → `video_id`). When you change a command's
signature, change both.

Most commands are thin: they take the `Db` state plus a few scalars, call the
matching method on `db`, and map the error. The interesting logic lives either
in `db.rs` (queries) or in the integration helpers (Phoneme, Google, YouTube).

### Videos & notes (the core of the app)

These back the library and the note editor. Every one is a one-liner that
delegates to a `db.rs` method.

| Command | Args | Returns | Does |
| :--- | :--- | :--- | :--- |
| `list_videos` | — | `Vec<VideoWithCount>` | Every video, newest first, with its note count. |
| `upsert_video` | `id`, `url` | `Video` | Insert if new (no-op on conflict), then return the row. |
| `set_video_title` | `id`, `title` | `()` | Rename a video. |
| `set_last_pos` | `id`, `secs` | `()` | Persist the resume position. |
| `set_pinned` | `id`, `pinned` | `()` | Pin/unpin in the library. |
| `set_video_tags` | `id`, `tags` | `()` | Replace a video's tag list (stored as a JSON array). |
| `set_ext_ref` | `id`, `ext_ref` | `()` | Set/clear the external link (the Phoneme `{"integration","ref"}` JSON). |
| `delete_video` | `id` | `()` | Delete a video; its notes cascade. |
| `list_notes` | `video_id` | `Vec<Note>` | A video's notes, by time — or by `order_index` when the video is in manual-order mode. |
| `create_note` | `video_id`, `t_secs`, `content` | `Note` | Insert a note (uuid id, `order_index` = current max + 1). |
| `update_note` | `id`, `content` | `()` | Edit a note's text (bumps `updated_at`). |
| `delete_note` | `id` | `()` | Delete one note. |
| `reorder_notes` | `video_id`, `ordered_ids` | `()` | Flip the video to manual order and write the new `order_index`es in a transaction. |
| `reset_order` | `video_id` | `()` | Drop manual order — notes sort by time again. |
| `search_notes` | `query` | `Vec<SearchHit>` | FTS5 full-text search across all notes (terms quoted + AND-ed). |

### Export / import / Markdown

| Command | Args | Returns | Does |
| :--- | :--- | :--- | :--- |
| `export_json` | — | `String` | Serialize all videos + notes to pretty JSON (the `Backup` shape). |
| `import_json` | `json` | `()` | Parse a `Backup` and `INSERT OR IGNORE` it (never clobbers existing rows). |
| `save_markdown` | `dir`, `name`, `content` | `String` | Write a Markdown file to a user-chosen folder (e.g. an Obsidian vault); validates the dir exists and returns the written path. |

`save_markdown` is the one core command that is **synchronous** (no `async`,
no `Db`) — it only touches the filesystem.

### Phoneme integration (`phoneme_*` and friends)

All best-effort. If the `phoneme` CLI isn't found or its daemon is down, these
fail and the UI degrades to "Phoneme not detected" — ytnt never bundles or
requires Phoneme. The binary is located by `resolve_phoneme()` and most calls go
through `run_phoneme(&[...])`; richer transcript features fall back from CLI →
REST (`127.0.0.1:3737`) → the Windows daemon named pipe. See
[integrations.md](integrations.md) for the resolution order and the parity rules.

| Command | Args | Returns | Does |
| :--- | :--- | :--- | :--- |
| `phoneme_available` | — | `bool` | CLI present *and* daemon answers a `list`. |
| `phoneme_probe` | — | `PhonemeProbe` | Richer probe: `present` (CLI), `daemon_ok`, reported `version`, and `compatible` (≥ `MIN_PHONEME_VERSION` = 1.8). Polled so a daemon dying/starting mid-session shows live. |
| `phoneme_tags` | — | `Vec<PhonemeTag>` | Phoneme's whole tag vocabulary with colors (so ytnt paints chips the same color). Empty when unavailable. |
| `phoneme_tags_for` | `rec_id` | `Result<Vec<PhonemeTag>>` | Tags on one recording — the *pull* side of membership sync. Returns `Err` (not empty) when unreachable, so the UI never mistakes "down" for "no tags". |
| `phoneme_apply_tags` | `rec_id`, `add`, `remove`, `colors` | `()` | The *push* side: create-if-missing (with color), then attach/detach by name. |
| `phoneme_update_tag` | `id`, `name`, `color` | `()` | Rename/recolor a Phoneme catalog tag globally, keeping its id and attachments. |
| `set_phoneme_bin` | `path` | `()` | Set the in-process override path (Settings → Phoneme CLI path). |
| `phoneme_import` | `url` | `String` | Hand a YouTube URL to Phoneme to download + transcribe; returns the new recording id. Runs off the async pool (`spawn_blocking`). |
| `phoneme_segments` | `id` | `Vec<Segment>` | A recording's transcript segments (empty while still transcribing). |
| `phoneme_chapters` | `id` | `Vec<Chapter>` | Stored auto-chapters (read-only `--show`; never triggers generation). |
| `phoneme_search` | `query` | `Vec<PhonemeHit>` | Semantic search across the whole Phoneme archive. |
| `phoneme_recording` | `id` | `PhonemeRec` | Full recording row: status, summary, model, language, duration, confidence, entities, tasks. |
| `phoneme_versions` | `id` | `Vec<TranscriptVersion>` | The whole transcript chain (raw ASR → each step → live) for side-by-side compare. CLI → REST → pipe fallback. |
| `phoneme_sse_start` | — | `()` | Open phoneme-rest's SSE stream and re-emit each event to the frontend as the Tauri `phoneme-event`. Returns once the stream is confirmed open. |
| `phoneme_sse_stop` | — | `()` | Stop forwarding SSE events. |

`set_phoneme_bin`, `phoneme_apply_tags`, and the rest of the simple Phoneme
commands are **synchronous** — `run_phoneme` blocks on a child process. The two
that can block for a long time (`phoneme_import`) or do network I/O
(`phoneme_versions`, `phoneme_sse_start`) are `async` and use `spawn_blocking` /
`reqwest` so they don't stall the runtime.

### YouTube (no account needed) and Google account (`google_*`)

`youtube_captions` and `import_youtube_playlist` use YouTube's public InnerTube
endpoints — **no OAuth**. The `google_*` commands and `sync_video_meta` use the
authenticated YouTube Data API over the OAuth installed-app loopback flow; they
all take `client_id` / `client_secret` (the caller's own, or fall back to the
compiled-in defaults) and refresh tokens transparently. See
[integrations.md](integrations.md) and the user-facing
[youtube_account_and_playlists.md](../user-guide/youtube_account_and_playlists.md).

| Command | Args | Returns | Does |
| :--- | :--- | :--- | :--- |
| `youtube_captions` | `video_id`, `lang?` | `Vec<Segment>` | Best-effort caption fetch via InnerTube (no auth). Fails often — many videos have none. |
| `import_youtube_playlist` | `playlist_id` | `usize` | Import a public/unlisted playlist via InnerTube; returns how many were newly added. |
| `google_status` | — | `bool` | Connected? (a stored refresh token exists). |
| `google_has_default` | — | `bool` | Were OAuth creds compiled in (so "connect with built-in client" is possible)? |
| `google_connect` | `client_id`, `client_secret` | `()` | Run the loopback OAuth flow, open the consent page, persist tokens. |
| `google_logout` | — | `()` | Delete the stored tokens. |
| `google_playlists` | `client_id`, `client_secret` | `Vec<GPlaylist>` | The account's playlists (Watch Later/History are not exposed by the API). |
| `sync_video_meta` | `client_id`, `client_secret`, `ids` | `()` | Fill library-card metadata (channel, views, duration, publish date) via `videos.list`, 50 ids per request. |
| `import_google_playlist` | `client_id`, `client_secret`, `playlist_id` | `usize` | Page through `playlistItems` and add them to the library. |
| `google_sync_playlist` | `client_id`, `client_secret`, `playlist_id`, `playlist_title` | `Vec<PlaylistItem>` | Cache a playlist's contents locally (so it's browseable and a delete knows the item id), returned with an `in_library` flag. |
| `google_remove_playlist_item` | `client_id`, `client_secret`, `playlist_id`, `video_id`, `item_id` | `()` | Remove one entry from the real YouTube playlist, then drop it from the local cache. |
| `video_playlists` | `video_id` | `Vec<PlaylistRef>` | Which synced playlists a video is in (with the item id needed to remove it). |

### Registration

Every command above must be listed in the `tauri::generate_handler![...]` macro
in `run()` at the bottom of [`lib.rs`](../../src-tauri/src/lib.rs). A command
that compiles but isn't in this list silently fails at runtime with an
"unknown command" error from `invoke`. The list is the single registration
point — there is no auto-discovery.

---

## 2. Errors, state, and async

### The `err` helper

The whole backend reports errors to the frontend as plain strings. Commands
return `Result<T, String>`, and the one-line helper at the top of `lib.rs`
turns any `Display` error into that string:

```rust
fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}
```

The idiomatic command body is therefore `db.something().await.map_err(err)` —
the `db.rs` method returns `Result<T, sqlx::Error>` and `err` flattens it for
the wire. Integration helpers build richer, user-facing messages directly
(e.g. `"Phoneme CLI not found (...)"`, `"Couldn't remove from playlist
(need write access?): ..."`) so the surfaced text is actionable, not a raw
library error.

### The `Db` state

There is one piece of managed state: `Db`, a thin wrapper over a
`sqlx::SqlitePool` ([`db.rs`](../../src-tauri/src/db.rs)). It's created once in
`setup` and registered with `app.manage(db)`. Any command that needs the
database declares `db: State<'_, Db>` as its first parameter and Tauri injects
it. `Db` is `Clone` (cloning clones the pool's `Arc`), and the pool itself is
`max_connections(5)`, so concurrent commands share connections without
contention.

Setup, in `run()`:

```rust
let dir = app.path().app_data_dir()...;          // %APPDATA%/<bundle-id>/
let dbfile = dir.join("ytnt.db");
let opts = SqliteConnectOptions::new()
    .filename(&dbfile)
    .create_if_missing(true)
    .foreign_keys(true)                          // ON DELETE CASCADE works
    .journal_mode(SqliteJournalMode::Wal);
let pool = SqlitePoolOptions::new().max_connections(5).connect_with(opts).await?;
sqlx::migrate!("./migrations").run(&pool).await?;  // apply migrations at startup
app.manage(Db { pool });
```

Migrations run here, at every startup, via `sqlx::migrate!`. The DB path, the
bundle identifier, and the **migration immutability rule** (a committed
migration is checksummed by its bytes — never edit one, only add a new file)
are covered in [data_model_and_migrations.md](data_model_and_migrations.md).

State that is *not* in the database lives elsewhere by design:

- **`PHONEME_OVERRIDE`** — a `static Mutex<Option<String>>` holding the
  in-process Phoneme-binary override that `set_phoneme_bin` pushes and
  `resolve_phoneme` reads first.
- **`SSE_GEN`** — a `static AtomicU64` generation counter so a newer
  `phoneme_sse_start` cancels the previous SSE bridge task.
- **Google tokens** — persisted to `google_tokens.json` in the app data dir
  (next to `ytnt.db`), not in SQLite.
- **Settings, tag colors, tag-sync snapshots** — all in the frontend's
  `localStorage`, never the backend. See
  [settings_reference.md](../user-guide/settings_reference.md).

### Async vs sync commands

A command is `async` when it awaits the pool or does network I/O, and plain
`fn` when it only does cheap synchronous work (a process spawn, a filesystem
write, a mutex read). Examples of each: `list_videos` is `async` (touches the
pool); `save_markdown` and `phoneme_tags` are sync. Anything that blocks for a
while inside an `async` command — a long child process or a pipe read — is
wrapped in `tauri::async_runtime::spawn_blocking` so it doesn't stall the
runtime (see `phoneme_import`, `phoneme_versions`, `google_connect`).

---

## 3. The database layer (`db.rs`)

`db.rs` is intentionally boring: a `Db` struct, a set of `#[derive(FromRow)]`
row structs, and one method per query. **All queries are runtime
(`sqlx::query` / `sqlx::query_as`), not the compile-time-checked macros**, so
there is no `DATABASE_URL` needed at build time and `cargo check` works without
a live database. The trade-off is that a typo in SQL or a column-name/struct
mismatch surfaces at runtime, not compile time — so exercise new queries with a
test or a manual run.

### Row structs

Each struct maps a query's result columns by name. `Serialize` lets them cross
the `invoke` boundary; `FromRow` lets sqlx build them from a row.

| Struct | Used by | Notes |
| :--- | :--- | :--- |
| `VideoWithCount` | `list_videos` | The library row: the video columns + a computed `note_count` (a `(SELECT COUNT(*) ...)` subquery). `view_count` and `published_at` are plain stored columns (migration 006), selected directly. |
| `Video` | `upsert_video` | The base video row (no derived count). |
| `Note` | `list_notes`, `create_note` | id, video_id, `t_secs`, content, `order_index`. |
| `SearchHit` | `search_notes` | A note joined to its video's title for the search results list. |
| `PlaylistItem` | `google_sync_playlist` | A cached playlist entry + an `in_library` flag. |
| `PlaylistRef` | `video_playlists` | Which playlist a video is in + the `item_id` to remove it. |
| `BackupVideo` / `BackupNote` / `Backup` | `export`/`import` | The JSON export shape (also `Deserialize`). |

`tags` is a `Json<Vec<String>>` — sqlx stores/loads the JSON column transparently
and it serializes to a plain string array on the wire.

### Query patterns worth knowing

- **`upsert_video`** does `INSERT ... ON CONFLICT(id) DO NOTHING` then selects
  the row, so it's idempotent and always returns the current state.
- **`create_note`** generates a `Uuid` id and computes `order_index` inline as
  `(SELECT COALESCE(MAX(order_index), 0) + 1 ...)`.
- **`list_notes`** sorts by `t_secs` unless the video's `manual_order` flag is
  set, in which case it sorts by `order_index` first (time as tiebreak).
- **`reorder_notes`** and **`sync_playlist`** / **`import_playlist`** /
  **`import`** run inside a `pool.begin()` transaction so a partial failure
  leaves nothing half-written.
- **`search_notes`** quotes every term (`"term"`, doubling embedded quotes) and
  AND-joins them, so FTS5 never chokes on user punctuation; results come back
  `ORDER BY rank LIMIT 50` from the `notes_fts` virtual table.
- **`set_video_meta`** uses `COALESCE(NULLIF(?, ''), title)` for `title` only
  (so an empty title is treated as no-op); the other four columns (channel,
  duration, view_count, published_at) use plain `COALESCE(?, col)`. Either way a
  NULL (or empty title) from the YouTube API leaves the existing value alone.

The FTS triggers, the `notes`/`videos`/`playlist_items` schema, and the
cascade behavior live in the migrations — see
[data_model_and_migrations.md](data_model_and_migrations.md).

---

## 4. Adding a new command end to end

Say you want a `set_note_starred(id, starred)` command. The full path:

1. **Schema (if needed).** If you need a new column/table, **add a new
   migration file** in `src-tauri/migrations/` (e.g. `007_note_starred.sql`) —
   never edit an existing one (it breaks every existing DB via a checksum
   mismatch). See [data_model_and_migrations.md](data_model_and_migrations.md).

2. **Query method in `db.rs`.** Add a method on `impl Db`, returning
   `Result<_, sqlx::Error>`, using runtime `sqlx::query` / `query_as`:

   ```rust
   pub async fn set_starred(&self, id: &str, starred: bool) -> Result<(), sqlx::Error> {
       sqlx::query("UPDATE notes SET starred = ? WHERE id = ?")
           .bind(starred).bind(id)
           .execute(&self.pool).await?;
       Ok(())
   }
   ```
   If it returns rows, add a `#[derive(Debug, Serialize, FromRow)]` struct for
   them.

3. **Command in `lib.rs`.** Add a thin `#[tauri::command]` wrapper that takes
   the `Db` state and maps the error with `err`:

   ```rust
   #[tauri::command]
   async fn set_note_starred(db: State<'_, Db>, id: String, starred: bool) -> Result<(), String> {
       db.set_starred(&id, starred).await.map_err(err)
   }
   ```

4. **Register it.** Add `set_note_starred,` to the
   `tauri::generate_handler![...]` list in `run()`. Forgetting this is the most
   common mistake — the command compiles but `invoke` returns "unknown command".

5. **Typed wrapper in `src/api.ts`.** Add the matching entry. Remember the
   camelCase→snake_case key mapping:

   ```ts
   setNoteStarred: (id: string, starred: boolean) =>
     invoke<void>("set_note_starred", { id, starred }),
   ```

6. **Verify.** Run the gates: in `src-tauri/` `cargo check` and `cargo test`,
   and from the repo root `npm run type-check`. Then exercise it via the UI or a
   test. See [testing_and_verification.md](testing_and_verification.md) and
   [how_to_extend.md](how_to_extend.md) for the full recipe and more worked
   examples.

```text
 migration (only if schema changes)
        │
        ▼
 db.rs  ──► impl Db method (runtime sqlx, Result<_, sqlx::Error>)
        │
        ▼
 lib.rs ──► #[tauri::command] wrapper (Db state + map_err(err))
        │
        ▼
 lib.rs ──► add to generate_handler![ … ]   ← easy to forget
        │
        ▼
 src/api.ts ──► typed invoke<…> wrapper (camelCase keys)
        │
        ▼
 cargo check / cargo test / npm run type-check
```

---

## 5. Where things live (quick reference)

| To change… | Touch |
| :--- | :--- |
| A query or the schema-facing logic | [`db.rs`](../../src-tauri/src/db.rs) (+ a new migration for schema) |
| A command's signature or a new command | [`lib.rs`](../../src-tauri/src/lib.rs) (function + `generate_handler!`) and [`src/api.ts`](../../src/api.ts) |
| How Phoneme is found / which transport is used | `resolve_phoneme` / `run_phoneme` / `phoneme_ipc` / `phoneme_rest_get` in [`lib.rs`](../../src-tauri/src/lib.rs); see [integrations.md](integrations.md) |
| The OAuth flow or token storage | the `google_*` helpers (`exchange_code`, `valid_access_token`, `*_tokens`) in [`lib.rs`](../../src-tauri/src/lib.rs) |
| Startup, the pool, or migration running | the `setup` closure in `run()` in [`lib.rs`](../../src-tauri/src/lib.rs) |

For build/run commands and prerequisites, see
[building_from_source.md](building_from_source.md). For the test gates and the
pre-PR checklist, see [testing_and_verification.md](testing_and_verification.md)
and [CONTRIBUTING.md](../../CONTRIBUTING.md).
