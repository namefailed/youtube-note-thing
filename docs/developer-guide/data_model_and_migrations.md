# Data model & migrations

This page traces ytnt's persistent state end to end: the SQLite schema (what each
table and column means, and the Rust `FromRow` structs that mirror them), where the
database file lives, and how the migration system works — including the single most
dangerous gotcha in the whole backend. **If you remember one thing from this doc:
a committed migration is immutable. Never edit one. Add a new numbered file.** The
[Migrations](#3-migrations) section explains why.

The schema is the source of truth, so prose here links straight to the files that
own it:

- DDL — [`src-tauri/migrations/`](../../src-tauri/migrations) (`001_init.sql` … `006_video_meta.sql`)
- Structs + queries — [`src-tauri/src/db.rs`](../../src-tauri/src/db.rs)
- Pool setup + `migrate!` call — [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) (`setup` hook)
- Endian-safe pinning — [`.gitattributes`](../../.gitattributes)

For how these queries are reached from the frontend, see the
[backend guide](backend_guide.md) and [architecture](architecture.md). For the
shape of the JSON exported by the backup feature, the `Backup*` structs below are
the contract.

## 1. Where the database lives

The whole app state is one SQLite file, `ytnt.db`, in the Tauri app-data
directory:

```text
%APPDATA%/dev.ytnt.app/         # Windows (the primary platform)
├── ytnt.db                     # videos, notes, FTS index, playlist cache
├── ytnt.db-wal                 # write-ahead log (WAL journaling is on)
├── ytnt.db-shm                 # WAL shared-memory index
└── google_tokens.json          # OAuth refresh/access tokens (not in SQLite)
```

The directory is resolved at startup in the `setup` hook of
[`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) via Tauri's
`app.path().app_data_dir()`, which derives the path from the bundle
**`identifier`** in [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json)
— currently `dev.ytnt.app`. On other platforms the parent differs (e.g.
`~/.local/share/dev.ytnt.app` on Linux, `~/Library/Application Support/dev.ytnt.app`
on macOS) but the file name is the same.

The pool is opened with these options (see the `setup` hook):

| Option | Value | Why |
| --- | --- | --- |
| `create_if_missing` | `true` | First launch creates `ytnt.db` from scratch, then migrations build the schema. |
| `foreign_keys` | `true` | Enforces `ON DELETE CASCADE` — deleting a video deletes its notes. |
| `journal_mode` | `WAL` | Hence the `-wal`/`-shm` sidecar files; better concurrency, fewer write stalls. |
| `max_connections` | `5` | Small pool; the app is single-user and not write-heavy. |

There is **no `DATABASE_URL` and no compile-time query checking**. Every query in
`db.rs` is a runtime `sqlx::query`/`query_as`, so nothing needs a live database at
build time — see the module comment at the top of
[`src-tauri/src/db.rs`](../../src-tauri/src/db.rs).

> Settings are **not** in SQLite. UI preferences (offset, autopause, theme, vault
> dir, Google client id/secret, hidden playlists, Phoneme binary, tag sync, tag
> color overrides, sync snapshots) live in browser `localStorage` — see the
> [settings reference](../user-guide/settings_reference.md). OAuth tokens live in
> `google_tokens.json` beside the DB. The DB holds library data only.

## 2. The schema

The schema is three logical concerns — **videos**, **notes** (plus their full-text
index), and the **playlist cache** — built up across six migrations. Below is the
current shape after all of them have run.

### 2.1 `videos`

One row per YouTube video in your library. Created in
[`001_init.sql`](../../src-tauri/migrations/001_init.sql); columns `tags`,
`ext_ref`, `pinned`, `view_count`, `published_at` were added by later migrations
(see [migration history](#33-migration-history)).

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `TEXT` PK | The YouTube video id (e.g. `dQw4w9WgXcQ`). |
| `title` | `TEXT NOT NULL DEFAULT ''` | Display title; backfilled from the YouTube Data API or editable by hand. |
| `channel` | `TEXT` | Channel name (library-card metadata). |
| `url` | `TEXT NOT NULL` | Canonical URL; imports store `https://youtu.be/<id>`. |
| `duration` | `INTEGER` | Video length in seconds. |
| `added_at` | `TEXT NOT NULL DEFAULT (datetime('now'))` | Insertion timestamp; the library sorts by this **descending**. |
| `last_pos_secs` | `REAL NOT NULL DEFAULT 0` | Resume position — where playback left off. |
| `manual_order` | `INTEGER NOT NULL DEFAULT 0` | `0` = sort notes by time; `1` = honor each note's `order_index`. |
| `tags` | `TEXT NOT NULL DEFAULT '[]'` | JSON array of tag names, stored inline on the row (added in `002`). |
| `ext_ref` | `TEXT` | External-integration link as JSON, e.g. `{"integration":"phoneme","ref":"<id>"}` (added in `003`). See [integrations](integrations.md). |
| `pinned` | `INTEGER NOT NULL DEFAULT 0` | Pinned videos sort to the top of the library (added in `004`). |
| `view_count` | `INTEGER` | YouTube view count for the library card (added in `006`). |
| `published_at` | `TEXT` | Publish date for the library card (added in `006`). |

**Tags are denormalized on purpose.** There is no tag table in ytnt — tag names are
a JSON array in `videos.tags`, read/written as a whole. Phoneme is the tag-catalog
authority; ytnt only mirrors membership. See [integrations](integrations.md) and the
[tags user guide](../user-guide/tags.md).

### 2.2 `notes` + full-text search

One row per timestamped note, owned by a video. Created in
[`001_init.sql`](../../src-tauri/migrations/001_init.sql).

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `TEXT` PK | A UUID v4 generated in Rust (`create_note` in `db.rs`). |
| `video_id` | `TEXT NOT NULL` | FK → `videos(id)` `ON DELETE CASCADE`. |
| `t_secs` | `REAL NOT NULL` | Timestamp in the video, in seconds. |
| `content` | `TEXT NOT NULL DEFAULT ''` | The note body (Markdown). |
| `order_index` | `INTEGER NOT NULL DEFAULT 0` | Manual sort position when `videos.manual_order = 1`. |
| `created_at` | `TEXT NOT NULL DEFAULT (datetime('now'))` | Insertion timestamp. |
| `updated_at` | `TEXT NOT NULL DEFAULT (datetime('now'))` | Bumped by `update_note` via `datetime('now')`. |

Supporting index:

```sql
CREATE INDEX idx_notes_video ON notes(video_id, t_secs);
```

so listing a video's notes in time order is a cheap index scan.

**Full-text search** uses an FTS5 external-content table mirroring `notes.content`:

| Object | Role |
| --- | --- |
| `notes_fts` | `fts5(content, content='notes', content_rowid='rowid')` — the search index; stores no copy of the text, just points back at `notes.rowid`. |
| `notes_ai` | `AFTER INSERT` trigger — adds the new row to the index. |
| `notes_ad` | `AFTER DELETE` trigger — issues the FTS5 `'delete'` command to drop the old row. |
| `notes_au` | `AFTER UPDATE` trigger — `'delete'` the old text, then insert the new. |

**Invariant: the three triggers keep `notes_fts` in lock-step with `notes`.** Never
write to `notes` in a way that bypasses them, or search results drift from reality.
`search_notes` in `db.rs` quotes each whitespace-split term (`"term"`,
double-quotes escaped by doubling) so FTS5 never chokes on punctuation, ANDs the
terms, and orders by `rank` with `LIMIT 50`. See the
[taking-notes guide](../user-guide/taking_notes.md) for the user-facing search.

### 2.3 `playlist_items` (playlist cache)

Created in [`005_playlists.sql`](../../src-tauri/migrations/005_playlists.sql). A
cached snapshot of YouTube playlists pulled from the Data API, so a playlist can act
as a browse/filter view independent of your library. A video may appear in several
playlists.

| Column | Type | Meaning |
| --- | --- | --- |
| `playlist_id` | `TEXT NOT NULL` | YouTube playlist id; part of the PK. |
| `playlist_title` | `TEXT NOT NULL DEFAULT ''` | Cached playlist name. |
| `video_id` | `TEXT NOT NULL` | YouTube video id; part of the PK. |
| `item_id` | `TEXT NOT NULL DEFAULT ''` | The YouTube `playlistItem` id — needed to remove the entry from the real playlist via the API. |
| `title` | `TEXT NOT NULL DEFAULT ''` | Cached video title at sync time. |
| `position` | `INTEGER NOT NULL DEFAULT 0` | Order within the playlist. |

`PRIMARY KEY (playlist_id, video_id)` plus
`idx_playlist_items_video ON playlist_items(video_id)` so the reverse lookup ("which
playlists is this video in?") is indexed.

**This table is a replaceable cache, not a source of truth.** `sync_playlist` in
`db.rs` deletes a playlist's rows and re-inserts them inside one transaction. It is
intentionally *not* foreign-keyed to `videos`: a playlist can list videos you have
not added to your library. `playlist_items` joins back to `videos` with a `LEFT JOIN`
to compute the `in_library` flag. See the
[YouTube account & playlists guide](../user-guide/youtube_account_and_playlists.md).

### 2.4 `FromRow` structs

The Rust side of the contract lives in
[`src-tauri/src/db.rs`](../../src-tauri/src/db.rs). Each struct is a hand-written
projection — the column list in the matching query must line up with the struct
fields, because nothing is checked at compile time.

| Struct | Backs | Notes |
| --- | --- | --- |
| `VideoWithCount` | `list_videos` | All card fields plus a `note_count` subquery; `tags` is `Json<Vec<String>>`. |
| `Video` | `upsert_video` | The core video row (no count, no metadata extras). |
| `Note` | `list_notes`, `create_note` | A single note row. |
| `SearchHit` | `search_notes` | A note joined to its video title for the search list. |
| `PlaylistItem` | `playlist_items` | Playlist row plus the computed `in_library` bool. |
| `PlaylistRef` | `video_playlists` | The `(playlist_id, playlist_title, item_id)` triple used to remove a video from a playlist. |
| `BackupVideo` / `BackupNote` / `Backup` | `export` / `import` | The JSON backup contract; `Backup` is `{ videos, notes }`. Import is `INSERT OR IGNORE`, so it never clobbers existing rows. |

Two things to note when adding fields:

- `tags` is typed `sqlx::types::Json<Vec<String>>`, so sqlx parses the JSON column
  for you. The setters serialize back to a string with `serde_json`.
- `manual_order` and `pinned` are `INTEGER` columns mapped to Rust `bool`. SQLite
  has no real boolean — keep storing `0`/`1`.

## 3. Migrations

Migrations live in [`src-tauri/migrations/`](../../src-tauri/migrations) and are
applied at startup by sqlx's compile-time-embedded macro in the `setup` hook of
[`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs):

```rust
sqlx::migrate!("./migrations").run(&pool).await?;
```

`migrate!` reads the directory **at build time**, bakes every `*.sql` file (and its
checksum) into the binary, and at runtime applies any not-yet-applied files in order,
recording each in the `_sqlx_migrations` table.

### 3.1 The immutability rule (read this)

> **sqlx checksums each migration by its raw file bytes. A migration that has ever
> run is immutable. Editing it — even a comment, even whitespace, even a line-ending
> flip — changes the checksum and breaks every existing database.**

When sqlx runs migrations, it compares the checksum baked into the binary against the
checksum stored in `_sqlx_migrations` for each already-applied version. If they
differ, the run fails with:

```text
error returned from database: Migrate(VersionMismatch(<n>))
```

…and the app cannot open the DB. The only recoveries are reverting the file to its
exact original bytes, or deleting the local database (losing data). Neither is
something you want to ship to a user, so **treat applied migrations as append-only
history.**

### 3.2 The line-ending trap (`.gitattributes`)

The subtlest way to trip the checksum is line endings. On a Windows-primary project,
git's `autocrlf` would happily rewrite `\n` to `\r\n` on checkout — silently changing
every migration's bytes and therefore its checksum. [`.gitattributes`](../../.gitattributes)
prevents this by marking the migrations binary-ish for EOL purposes, so git never
normalizes or converts their endings — the committed bytes (and therefore the sqlx
checksums) stay stable:

```text
src-tauri/migrations/*.sql -text
```

`-text` tells git **never** to do end-of-line conversion on these files, so the bytes
on disk match the bytes that were committed, on every machine. **Do not remove this
line, and make sure any new migration is saved with LF endings.**

### 3.3 Migration history

| File | Adds |
| --- | --- |
| [`001_init.sql`](../../src-tauri/migrations/001_init.sql) | `videos`, `notes`, `idx_notes_video`, `notes_fts` + the three sync triggers. |
| [`002_tags.sql`](../../src-tauri/migrations/002_tags.sql) | `videos.tags` (`TEXT NOT NULL DEFAULT '[]'`). |
| [`003_ext_ref.sql`](../../src-tauri/migrations/003_ext_ref.sql) | `videos.ext_ref` (external-integration link). |
| [`004_pinned.sql`](../../src-tauri/migrations/004_pinned.sql) | `videos.pinned`. |
| [`005_playlists.sql`](../../src-tauri/migrations/005_playlists.sql) | `playlist_items` + `idx_playlist_items_video`. |
| [`006_video_meta.sql`](../../src-tauri/migrations/006_video_meta.sql) | `videos.view_count`, `videos.published_at`. |

### 3.4 The right way to evolve the schema

1. **Add a new numbered file**, never edit an existing one. Use the next number and a
   short description: `007_<thing>.sql`. The numeric prefix sets the order.
2. **Keep it forward-only and additive where possible.** Prefer `ALTER TABLE ... ADD
   COLUMN` with a `DEFAULT`, or `CREATE TABLE IF NOT EXISTS`, so it applies cleanly on
   top of existing data. SQLite's `ALTER TABLE` is limited (no drop/rename column on
   older engines) — to reshape a table, create the new one, copy rows, then swap.
3. **Save it with LF endings.** The `.gitattributes` pin keeps it that way once
   committed, but your editor must write LF the first time.
4. **Update `db.rs` to match.** Add the column to the relevant `FromRow` struct *and*
   to every `SELECT` column list that feeds it — there is no compile-time check
   linking the two, so a mismatch surfaces as a runtime decode error, not a build
   failure.
5. **Build once to embed it.** `migrate!` snapshots the directory at compile time;
   rebuild so the new file (and its checksum) is baked in.
6. **Verify.** Run `cargo test` and `cargo check` in `src-tauri/`, launch the app on a
   pre-existing `ytnt.db`, and confirm migrations apply with no `VersionMismatch`. See
   [testing & verification](testing_and_verification.md).

For broader guidance on adding a backend command that uses your new column, see
[how to extend](how_to_extend.md).
