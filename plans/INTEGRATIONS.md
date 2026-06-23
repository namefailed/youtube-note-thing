# Integrations

Integrations are **optional and pluggable**. The core never depends on one. This doc defines the seam,
the built-in export, and the flagship adapter (Phoneme), and shows how the community adds more.

## The seam

An integration is a backend the app can *discover at runtime* and call through one dispatch function.
The contract is capability-based, not app-specific — so "Phoneme" and "some other transcription
backend" plug into the same slots.

```rust
/// What the core asks of any integration. All async, all fallible.
trait Integration {
    fn id(&self) -> &str;                       // "phoneme", "obsidian", ...
    fn probe(&self) -> Presence;                // present + version, or absent — cheap, called on a timer

    fn capabilities(&self) -> &[Capability];    // a subset of the enum below
    async fn dispatch(&self, action: Action) -> Result<Value, IntegrationError>;
}

enum Capability {
    Transcript,   // turn a video into a timed transcript + (maybe) chapters
    Search,       // search across the backend's own corpus (semantic/FTS)
    Ask,          // grounded Q&A over the corpus
    Export,       // push notes somewhere (PKM)
    Clip,         // export a media clip for a time range
}
```

Rules that keep this from rotting into a framework:

- **One dispatch function in the core**, a `match` over integration id — not a plugin loader, until a
  real third integration proves more is needed.
- The core imports **no integration's types**. `Action`/`Value` are plain serde JSON.
- The frontend renders an integration's UI **only when `probe()` says present**, and only for the
  capabilities it advertises. Absent backend → the UI simply isn't there (no dead buttons).
- A capability the user's chosen backend lacks is invisible, not an error.

## Built-in: Markdown / Obsidian (no integration needed)

These ship in the core because they're trivial and have no external dependency.

- **Markdown files** — write `.md` to a configured directory. Filename pattern, optional per-channel
  subfolders. This is the universal fallback: anything that reads Markdown (Obsidian, Logseq, plain
  files) can point at it.
- **Obsidian** — if the user runs the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)
  plugin, `PUT`/`PATCH` notes into a vault folder over `https://127.0.0.1:27124`. Token in the OS
  keychain. If the plugin isn't there, the Markdown-files path covers Obsidian anyway.

Output format (both):

```markdown
# {{video title}}
**Channel:** {{channel}} · **URL:** {{url}}

## Notes
- [00:33](https://youtu.be/VIDEO_ID?t=33) First observation
- [01:55](https://youtu.be/VIDEO_ID?t=115) Key insight
```

## Flagship adapter: Phoneme

[Phoneme](https://github.com/namefailed/phoneme) is the author's local-first voice-transcription app.
It already does — verified in its source — everything the original plan tried to rebuild:
on-device Whisper transcription, **YouTube audio download via yt-dlp**, auto-chapters/entities/tasks,
FTS5 + hybrid semantic search, RAG Q&A, audio-clip export, and PKM export via hooks. So this adapter is
*thin*: it hands work to Phoneme and reads results back.

### How it connects: CLI + REST (not a linked crate)

The original plan linked Phoneme's `phoneme-ipc` crate and spoke the raw named-pipe protocol over two
connections. Unnecessary — Phoneme ships an HTTP server (`phoneme-rest`) and a CLI that already cover
what we need, with zero Rust coupling and no version-locked crate dependency.

| Need | Phoneme surface | Verified at |
|------|-----------------|-------------|
| Is Phoneme present? | `GET /api/status` | `bin/phoneme-rest/src/request_map.rs` |
| Send a YouTube video for transcription | `phoneme import <URL>` (CLI; downloads via yt-dlp, prints recording id) | `bin/phoneme/src/commands/import.rs` |
| Timed transcript | `GET /api/recordings/:id/segments` | request_map.rs |
| Auto-chapters | `GET /api/recordings/:id/chapters` | request_map.rs |
| Semantic search across everything | `GET /api/search?q=…` | request_map.rs |
| "More like this" | `GET /api/recordings/:id/similar` | request_map.rs |
| Live progress | SSE stream | `bin/phoneme-rest/src/sse.rs` |
| PKM export | Phoneme hooks (`to-org-journal`, `to-denote`, `to-markdown-daily`, `to-timestamped-note`, `to-todoist`, `to-webhook`) | `hooks/` |

> **Import-over-HTTP gap (real):** `phoneme-rest`'s route map does **not** expose import today; the CLI
> does. v1 shells out to `phoneme import <url>`. The clean follow-up is a small `POST /api/import {url}`
> added to `phoneme-rest` (it maps to the same path the CLI already walks). Both projects share an
> author, so this is a one-PR change — but the CLI path works with zero changes to Phoneme.

### Flow

```
1. User loads a YouTube video, clicks "Transcribe with Phoneme" (shown only if probe() = present).
2. Backend runs: phoneme import <url>  → captures the printed recording id.
3. Store {"integration":"phoneme","ref":"<rec id>"} in videos.ext_ref.
4. Subscribe to Phoneme's SSE; show pipeline progress (transcribing → done).
5. On done: GET /segments + /chapters → render a transcript panel beside the player,
   each segment a clickable timestamp (seekTo).
6. Global search can now also query GET /api/search and merge Phoneme hits with local note hits.
```

### Capabilities this adapter advertises

- **Transcript** ✅ (import + segments + chapters)
- **Search** ✅ (`/api/search`)
- **Export** ✅ — delegate to Phoneme's hooks rather than re-implementing PKM adapters.
- **Ask / Clip** — *deferred.* RAG (`Ask`) and `ExportClip` exist in Phoneme's named-pipe schema but
  aren't on the REST surface yet. Add when either a REST route lands or we accept a named-pipe path.
  Don't advertise the capability until it's wired — no dead buttons.

### Standalone fallback

With Phoneme absent, the transcript panel shows YouTube's own captions when available, or a one-line
"Connect Phoneme for on-device transcription, search, and Q&A" with a link. Notes, library, search over
*your notes*, and Markdown/Obsidian export all keep working.

## Adding a community integration

1. Implement `Integration` for your backend (probe + capabilities + dispatch).
2. Add one arm to the core's dispatch `match`.
3. Advertise only the capabilities you actually wire.

No core changes beyond the one match arm; no UI changes (the frontend renders from `capabilities()`).
Good first targets the seam is shaped for: Notion, Logseq, Readwise, or an alternative transcription
backend (a cloud Whisper service, a different local daemon).
