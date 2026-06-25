# Integrations (Phoneme & Google)

ytnt is **local-first and self-contained** — it stores videos and timestamped notes in its own SQLite database and needs nothing else to work. Two integrations are **optional** and bolt on extra capability:

- **[Phoneme](https://github.com/)** — a sibling local transcription app. ytnt sends it YouTube URLs to transcribe, reads back transcripts / summaries / chapters, and keeps tag membership in sync. **Phoneme is the authority for the tag catalog;** ytnt mirrors it.
- **Google / YouTube** — an OAuth account link so you can browse your real playlists, toggle videos in and out of your library, remove an entry from a playlist, and pull view-count / duration / channel metadata.

Both degrade gracefully: if Phoneme isn't installed or Google isn't connected, those panels just disappear and the rest of the app is unaffected. **Neither is bundled or required.**

This page traces both integration boundaries end-to-end and names the function at each hop. It's the companion to the inline doc comments in [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) (the Rust command surface) and [`src/lib.ts`](../../src/lib.ts) (the pure helpers) — those comments are the canonical reference; this page is the map.

**See also:** the user-facing walkthroughs in [Phoneme integration](../user-guide/phoneme_integration.md) and [YouTube account & playlists](../user-guide/youtube_account_and_playlists.md); the backend command list in [Backend guide](backend_guide.md); the `ext_ref` column in [Data model & migrations](data_model_and_migrations.md); and [How to extend](how_to_extend.md) for adding a second backend.

---

## 1. The shape of an integration

Every integration follows the same rule: **the Rust backend owns all I/O, the frontend only invokes typed commands.** No webview ever talks to Phoneme's daemon or Google's API directly — that keeps secrets, CORS, and process-spawning on the Rust side.

```
 src/app.ts (Lit component)
        │  api.phoneme* / api.google*   (typed invoke wrappers, src/api.ts)
        ▼
 src-tauri/src/lib.rs  #[tauri::command] handlers
        │
        ├──► Phoneme CLI  (std::process::Command, resolve_phoneme())
        ├──► phoneme-rest (reqwest, 127.0.0.1:3737, opt-in)
        ├──► Phoneme daemon pipe (\\.\pipe\phoneme-daemon, Windows-only)
        └──► Google APIs (reqwest, OAuth 2.0 loopback)
```

A video's link to an integration lives in **one column**: `videos.ext_ref`, a self-describing JSON blob (see [§4](#4-ext_ref-the-link-format)). That single column is what lets a second backend coexist without a schema change.

---

## 2. Phoneme

### 2.1 Locating the binary — `resolve_phoneme()`

ytnt shells out to the `phoneme` CLI, so it must find the binary even when it isn't on `PATH`. [`resolve_phoneme()`](../../src-tauri/src/lib.rs) checks these sources **in order** and returns the first hit:

| Order | Source | Notes |
|-------|--------|-------|
| 1 | **Frontend override** (`PHONEME_OVERRIDE` static) | Set from **Settings → Phoneme CLI path** (`phonemeBin` setting) via the `set_phoneme_bin` command. Wins over everything. |
| 2 | **`PHONEME_BIN` env var** | For launching ytnt with an explicit binary, e.g. CI or a custom install. |
| 3 | **`PATH`** | Cheap existence check (`on_path()`, no process spawn). Returns the bare name `"phoneme"`. |
| 4 | **`~/.cargo/bin/phoneme`** | A `cargo install` of Phoneme. |
| 5 | **`~/Projects/dev/phoneme/target/{release,debug}/phoneme`** | The usual local dev build of the sibling repo. |
| — | **fallback** | Bare `"phoneme"`, so a genuine miss surfaces as "not found" rather than a bogus path. |

On Windows the executable name is `phoneme.exe`; elsewhere `phoneme`. The override is a process-global `Mutex<Option<String>>`; the frontend pushes the current `phonemeBin` setting on startup and whenever it changes, so a setting edit takes effect without a restart.

> **Invariant — best-effort, never fatal.** Every Phoneme call can fail (CLI missing, daemon down, wrong version) and the UI degrades to "Phoneme not detected" instead of erroring. `run_phoneme()` turns a spawn failure into `Err("Phoneme CLI not found …")`; the frontend treats that as "Phoneme unavailable", not a crash.

### 2.2 CLI-first, REST/pipe fallback

Phoneme exposes three transports. ytnt prefers the one that needs the least setup:

| Transport | Used by | Why |
|-----------|---------|-----|
| **CLI** (`std::process::Command`) | Almost everything — `import`, `show`, `chapters`, `search`, `tag *`, `versions` | Always available, cross-platform, no opt-in. The default path. |
| **phoneme-rest** (`reqwest`, `http://127.0.0.1:3737`) | `phoneme_versions` fallback, live SSE progress (`phoneme_sse_start`) | Opt-in (Phoneme's `[rest_api]`), loopback-only. `reqwest` sends no `Origin` header, so it passes phoneme-rest's loopback-Origin guard a webview `fetch` would fail. |
| **Daemon named pipe** (`\\.\pipe\phoneme-daemon`) | Last-resort `phoneme_versions` | **Windows-only** today (`phoneme-ipc` has no Unix-socket transport). Off Windows, pipe-only paths return a clear "only available on Windows for now" notice rather than silently no-op'ing. |

`phoneme_versions` is the clearest example of the cascade: it tries the **CLI** first (`phoneme --json versions <id>`), then **phoneme-rest** (`GET /api/recordings/:id/versions`), then the **named pipe** (`list_transcript_versions`) — see [`phoneme_versions`](../../src-tauri/src/lib.rs).

> **CLI / transport parity.** The same recording data is reachable by whichever transport is up. The full transcript-version chain (raw ASR → each pipeline step → live) is the one feature that originally needed the pipe; the CLI and REST routes were added so it works cross-platform when the pipe can't be dialed.

### 2.3 Detecting availability — `phoneme_available` vs `phoneme_probe`

| Command | Returns | Meaning |
|---------|---------|---------|
| `phoneme_available` | `bool` | A `phoneme --json list --limit 1` succeeded — the full feature path (daemon) is usable. |
| `phoneme_probe` | `PhonemeProbe { present, daemon_ok, version, compatible }` | Richer: `present` = CLI runs (`phoneme version` succeeds, no daemon needed); `daemon_ok` = a `list` succeeded; `compatible` = `version >= MIN_PHONEME_VERSION` (`1.8`). |

The frontend **polls `phoneme_probe`** so a daemon that dies or starts mid-session is reflected live, and a too-old CLI degrades loudly (a "update Phoneme" notice) instead of showing blank panels. An **unknown/unparseable version is treated as compatible** — don't lock the user out of a custom build. The minimum is the lowest version whose `--json` contract ytnt was built against (e.g. `chapters --show`, `show --segments`).

### 2.4 The `phoneme_*` command surface

All commands live in [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) and are wrapped 1:1 in [`src/api.ts`](../../src/api.ts) under `api.phoneme*`.

| Command | Underlying call | Returns / notes |
|---------|-----------------|-----------------|
| `set_phoneme_bin(path)` | — | Pushes the `phonemeBin` override into `PHONEME_OVERRIDE`. |
| `phoneme_available()` | `--json list --limit 1` | `bool`. |
| `phoneme_probe()` | `version` + `list` | `PhonemeProbe`. |
| `phoneme_import(url)` | `import <url>` | Hands a YouTube URL to Phoneme (download + queue transcription); returns the new recording id. Runs on `spawn_blocking` because the download blocks. |
| `phoneme_recording(id)` | `--json show <id>` | `PhonemeRec` — status to poll, title, summary, model, language, duration, confidence, entities, tasks. |
| `phoneme_segments(id)` | `--json show <id> --segments` | `Segment[]`. Empty while still transcribing (a normal state). |
| `phoneme_chapters(id)` | `--json chapters <id> --show` | `Chapter[]`. **Read-only** — `--show` never triggers the LLM chapter step. |
| `phoneme_versions(id)` | CLI → REST → pipe | `TranscriptVersion[]` for side-by-side compare. |
| `phoneme_search(query)` | `--json search <q> --limit 10` | `PhonemeHit[]` — semantic search across the whole Phoneme archive. |
| `phoneme_tags()` | `--json tag list --all` | `PhonemeTag[]` — the whole catalog with colors (`--all` includes orphans), so ytnt paints chips the same color Phoneme does. |
| `phoneme_tags_for(rec_id)` | `--json tag for <rec_id>` | `PhonemeTag[]` for one recording — the **pull** side of sync. Returns `Err` (not `[]`) when unreachable, so "couldn't reach Phoneme" is never mistaken for "no tags". |
| `phoneme_apply_tags(rec_id, add, remove, colors)` | `tag add` / `tag attach` / `tag detach` | The **push** side: create-if-missing (with color), then attach/detach by name. Any attach/detach failure propagates so the change stays pending. |
| `phoneme_update_tag(id, name, color)` | `tag update <id> <name> [--color]` | **Global rename** by id — keeps the tag's id and every attachment (see [§3.3](#33-true-global-rename)). |
| `phoneme_sse_start()` / `phoneme_sse_stop()` | `GET /api/events` | Bridges phoneme-rest SSE `DaemonEvent`s to a Tauri `phoneme-event`; a generation counter cancels a superseded bridge. Used for live progress; the frontend keeps polling as a fallback. |

> **Contract-drift safety.** `parse_json_lines()` keeps the good lines and logs (doesn't drop) bad ones, but returns `Err` when there *was* output yet **nothing** parsed — the sign a Phoneme version changed its JSON shape. That surfaces a quiet notice instead of a silently-blank panel. Genuinely empty output (nothing transcribed yet) is a normal empty `Vec`.

(Two related commands are **YouTube-side, not Phoneme:** `youtube_captions` fetches a video's own caption track via InnerTube — no auth, fragile by nature — and `import_youtube_playlist` imports a public/unlisted playlist via InnerTube. They live next to the Phoneme code but don't touch Phoneme.)

### 2.5 Linking a video to a recording

When you transcribe a video, ytnt records the resulting Phoneme recording id in `videos.ext_ref` via `set_ext_ref` (`serializeRef(rec)` on the way in, `parseRef` on the way out — see [§4](#4-ext_ref-the-link-format)). `unlinkRef()` clears it (`set_ext_ref(id, null)`) when the recording no longer resolves, so you can transcribe again.

---

## 3. Tag membership sync

Tags are shared between ytnt and Phoneme. **Phoneme owns the tag catalog** (names, colors, ids); ytnt mirrors the colors for its chips and keeps *which video has which tag* in sync. There is **no daemon and no catalog in ytnt** — sync is driven entirely from the frontend, on demand, with state in `localStorage`.

The relevant settings/state keys:

| `localStorage` key | Holds |
|--------------------|-------|
| `ytnt.settings` → `syncTags` | Master on/off for tag sync (default `true`). |
| `ytnt.tagColors` | ytnt's local color overrides per tag (lowercased name → hex). |
| `ytnt.tagSyncBase` | **Per-video base snapshot** — the tag set as of the last successful sync. The third leg of the merge. |

### 3.1 The 3-way merge — `mergeTagSets`

The merge is a pure function in [`src/lib.ts`](../../src/lib.ts): `mergeTagSets(base, local, remote) → { merged, toAttach, toDetach }`.

```
        base   = tag set at last successful sync (null = never synced)
        local  = ytnt's tags for this video
        remote = Phoneme's tags for the recording (phoneme_tags_for)
                          │
                          ▼
   added(tag)   = in local-or-remote but NOT in base   → keep it
   removed(tag) = in base but NOT in local-or-remote   → drop it
                          │
                          ▼
   merged   = the reconciled set written back to ytnt + Phoneme
   toAttach = in merged, not yet on Phoneme   → push (attach)
   toDetach = on Phoneme, not in merged       → push (detach)
```

Key properties, all enforced by the code:

- **Unambiguous, no conflicts.** Because "added" means *not in base* and "removed" means *in base*, a tag can't be both. There is nothing to resolve.
- **First sync = union.** When `base` is `null` (never synced), the result is `local ∪ remote` — with no history, never delete.
- **Case-insensitive** (Phoneme tags are CI-unique); the merged **display name prefers remote casing**, then local, then base.

### 3.2 Reconcile, pending queue, and the base snapshot

The orchestration is `reconcileVideoTags(videoId)` in [`src/app.ts`](../../src/app.ts):

1. Bail (leave pending, base untouched) if `syncTags` is off, the video isn't linked to a Phoneme recording, or Phoneme is unreachable.
2. **Pull** remote tags via `phoneme_tags_for`. On error, return early and **never detach** — a transient outage must not wipe tags.
3. Run `mergeTagSets`.
4. **Push** `toAttach` / `toDetach` via `phoneme_apply_tags` (with colors). If the push fails, **don't advance the base** — the change retries later.
5. Write `merged` back to ytnt (`set_video_tags`) if it changed, then **advance `tagSyncBase[videoId] = merged`** and persist it.

> **Invariant — the base only advances on a fully successful round-trip.** A drift between a video's local tags and its base snapshot *is* the pending queue. `flushPendingTags()` drains it: when the daemon reappears, every linked video whose tags differ from its base is reconciled. `syncAllTags()` (the **Sync all** button in the Tag Manager) forces a full pull+push across every linked video regardless of drift.

This is **bidirectional**: a tag added in Phoneme flows into ytnt on the next pull; a tag added in ytnt is pushed on the next reconcile. No background loop — it runs when tags change, when Phoneme comes back, or on explicit **Sync all**.

### 3.3 True global rename

Renaming a tag in ytnt (`renameTag` in [`src/app.ts`](../../src/app.ts)) does the local work — rewrite every video's tag list, migrate the color override, update the active filter — and then, **if** `syncTags` is on and Phoneme is up, looks the old name up in `phoneme_tags()` and calls `phoneme_update_tag(id, newName, color)`.

This is a **real global rename**, not a detach-old + attach-new. `phoneme_update_tag` keeps the catalog tag's **id and every attachment**, so the rename propagates to all of Phoneme without orphaning the old tag. (A detach/attach would leave the old, now-empty tag littering Phoneme's catalog.) If Phoneme is down, the rename is purely local and the next reconcile converges.

---

## 4. `ext_ref` — the link format

A video's external-backend link is stored in **`videos.ext_ref`** as self-describing JSON:

```json
{ "integration": "phoneme", "ref": "<recording-id>" }
```

The helpers live in [`src/lib.ts`](../../src/lib.ts):

- **`serializeRef(ref, integration = "phoneme")`** → the JSON string written via `set_ext_ref`.
- **`parseRef(extRef)`** → `{ integration, ref } | null`. It tolerates **legacy bare-string rows** (a plain recording id with no JSON wrapper) by treating them as `{ integration: "phoneme", ref: extRef }`.

The frontend always checks `integration === "phoneme"` before using `ref` as a Phoneme recording id (`phonemeRef()`, `recId()`). **That guard is the whole reason a second backend can coexist** in the same column without a migration.

---

## 5. Google / YouTube account link

The Google integration uses the standard OAuth 2.0 **installed-app loopback flow**, run entirely from Rust. Watch Later / History are **not exposed** by the YouTube Data API — only real playlists are.

### 5.1 The loopback OAuth flow — `google_connect`

[`google_connect`](../../src-tauri/src/lib.rs) does this:

1. Resolve credentials (`resolve_creds`, see [§5.3](#53-bundled-vs-your-own-credentials)).
2. Bind a `TcpListener` on `127.0.0.1:0` — the OS picks a free port; `redirect_uri = http://127.0.0.1:<port>`.
3. Build the consent URL (`https://accounts.google.com/o/oauth2/v2/auth`) with `response_type=code`, **`access_type=offline`**, **`prompt=consent`** (both forced so Google returns a refresh token), the client id, the loopback redirect, and the scope.
4. Open the consent page in the user's browser (`tauri-plugin-opener`).
5. `wait_for_code()` blocks on the listener (off the async pool via `spawn_blocking`), captures the redirect, serves a small "Connected ✓" HTML page, and parses the `code` query param.
6. `exchange_code()` POSTs to `https://oauth2.googleapis.com/token` (`grant_type=authorization_code`) for the access + refresh tokens.
7. **Reject if no refresh token** came back ("remove this app from your Google account's third-party access and try again") — without it, the link can't survive a restart.
8. Persist via `save_tokens()`.

Tokens are stored as `google_tokens.json` in the app data dir (`app_data_dir()/google_tokens.json`) — **not** in `localStorage`. `google_logout` deletes that file; `google_status` reports connected iff a non-empty refresh token is on disk.

### 5.2 Scopes

A single scope is requested: **`https://www.googleapis.com/auth/youtube`** (read **and** write). The write half is what lets `google_remove_playlist_item` delete a real playlist entry; the read half backs metadata and playlist browsing.

### 5.3 Bundled vs. your own credentials

ytnt can ship with a **built-in OAuth client** so "Connect YouTube" works with zero setup:

- **`build.rs`** (`embed_google_creds`) compiles `YTNT_GOOGLE_CLIENT_ID` / `YTNT_GOOGLE_CLIENT_SECRET` into the binary via `option_env!`. Values come from a **gitignored `../.env`** (local dev — copy [`.env.example`](../../.env.example)) or process env (CI secrets); process env wins. They never live in committed source or the JS bundle. Google treats Desktop-app client secrets as non-confidential, so this is safe.
- At runtime, `default_google()` reads those compiled-in values; `google_has_default()` tells the UI whether a built-in client exists.
- `resolve_creds(id, secret)` uses the **caller's** credentials if the user supplied their own (Settings → `gClientId` / `gClientSecret`), otherwise falls back to the built-in client. If neither exists it errors: *"No Google credentials — connect with the built-in client or add your own in Settings."*

> If you build from source without a `.env`, the bundled client is blank and every user must paste their own client id/secret in Settings. See [Building from source](building_from_source.md).

### 5.4 Token refresh — `valid_access_token`

Every API call goes through [`valid_access_token`](../../src-tauri/src/lib.rs):

1. Load tokens; error if not connected.
2. If the access token is non-empty and `expires_at > now + 60s`, return it as-is.
3. Otherwise, if there's no refresh token, error ("Session expired — reconnect").
4. Refresh via `grant_type=refresh_token`, update `access_token` + `expires_at`, persist, and return the fresh token.

The 60-second skew means a token about to expire mid-request is refreshed pre-emptively.

### 5.5 The YouTube Data API commands

| Command | Endpoint | Purpose |
|---------|----------|---------|
| `google_connect` | OAuth | Start the loopback flow (above). |
| `google_status` / `google_has_default` / `google_logout` | — | Connection state and built-in-client probe; clear stored tokens. |
| `google_playlists` | `GET playlists?mine=true` | List your playlists (id, title, item count). |
| `sync_video_meta(ids)` | `GET videos?part=snippet,statistics,contentDetails` | Fill library-card metadata — channel, view count, ISO-8601 duration (parsed to seconds by `parse_iso8601_duration`), publish date. **Batches 50 ids per request.** |
| `import_google_playlist` | `GET playlistItems` (paged) | Import every video in a playlist into the library. |
| `google_sync_playlist` | `GET playlistItems` (paged) | Cache one playlist's contents locally (so it can be browsed and a delete knows the `playlistItem` id); returns items with an `in_library` flag. |
| `google_remove_playlist_item` | `DELETE playlistItems?id=<item_id>` | Remove one entry from the real YouTube playlist (needs the write scope), then drop it from the local cache. |
| `video_playlists(video_id)` | local cache | Which synced playlists a video is in (with the `item_id` needed to remove it). |

`playlistItems` is paged (`maxResults=50` + `nextPageToken`); `videos.list` is batched 50 ids at a time. All of these take the user's `client_id` / `client_secret` (possibly empty → built-in) and resolve them through `valid_access_token`.

For the user-facing flow, see [YouTube account & playlists](../user-guide/youtube_account_and_playlists.md) and the [Settings reference](../user-guide/settings_reference.md).

---

## 6. Adding a second backend

The `ext_ref` design exists so you can add another transcription/notes backend (say, a hypothetical `whisperx`) **without a schema change**. The shape to follow:

1. **Pick an integration key** — the string stored in `ext_ref.integration` (e.g. `"whisperx"`). `parseRef` / `serializeRef` already carry it; `serializeRef(ref, "whisperx")` is all the write side needs.
2. **Add backend commands** in [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) mirroring the Phoneme set you need (availability probe, import, fetch transcript), and register them in the `invoke_handler!` list.
3. **Wrap them** in [`src/api.ts`](../../src/api.ts) as typed `invoke` calls — camelCase JS keys map to snake_case Rust params automatically.
4. **Branch on `integration`** in the frontend. The existing code already guards with `r.integration === "phoneme"` (`phonemeRef`, `recId`); add the parallel `=== "whisperx"` branch so a video linked to one backend never gets dispatched to the other.
5. **Reuse the merge if the backend has tags.** `mergeTagSets` and the `tagSyncBase` snapshot are backend-agnostic — only the pull (`phoneme_tags_for`) and push (`phoneme_apply_tags`) calls are Phoneme-specific. Swap those for the new backend's equivalents and keep the same per-video-base discipline.

Because the link is one self-describing column, **two backends coexist per-video**: each video points at exactly one, and `parseRef` tells you which. See [How to extend](how_to_extend.md) for the broader extension guide and [Data model & migrations](data_model_and_migrations.md) for the `ext_ref` column.
