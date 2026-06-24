# Asks to Phoneme

Things ytnt (youtube-note-thing) would benefit from Phoneme exposing. ytnt is a
thin, best-effort client: it works fully with no Phoneme installed and every
Phoneme call degrades gracefully. These asks would let ytnt drop CLI spawns,
work cross-platform, and check compatibility without guessing.

Contracts referenced below were verified against the Phoneme source on
2026-06-23 (versions/line numbers may drift).

## 1. `POST /api/import {url}` on phoneme-rest

Import is **CLI-only** today (`phoneme import <url>`, args.rs `ImportArgs`;
`phoneme-ipc::Request::ImportRecording` only takes a local `path`, not a URL —
the yt-dlp download lives in the CLI's `commands/import.rs`). ytnt has to spawn
the `phoneme` binary to hand over a YouTube URL.

Ask: a REST route (and/or an IPC `Request` variant) that takes an http(s) URL
and runs the same yt-dlp download + enqueue the CLI does, returning the new
recording id. Then ytnt could drop its CLI spawn for the import path entirely.

## 2. Cross-platform reach for the pipe-only features (the real blocker)

Phoneme's IPC is **Windows named-pipe only**: `crates/phoneme-ipc/src/named_pipe.rs`
uses `tokio::net::windows::named_pipe`, and `pipe_path()` returns
`\\.\pipe\<name>` (default name `phoneme-daemon`, config.rs:3967). There is no
Unix-domain-socket transport, so on macOS/Linux ytnt literally cannot dial the
daemon.

These features live **only** on the pipe (no CLI, no REST), so they are
Windows-only in ytnt today:

- `ListTranscriptVersions { id }` — the compare-versions chain (schema.rs ~378).
- `Ask { … }` / `AskActivity` stream — RAG Q&A (CLI `phoneme ask` exists but
  streams over the pipe; no REST route in request_map.rs).
- `ExportClip { id, start_ms, end_ms, out_path? }` — audio clip export
  (schema.rs ~450; CLI `phoneme clip` exists, no REST route).

Asks, any of which unblocks ytnt off-Windows:
- REST routes for `GET /api/recordings/:id/versions`, an Ask endpoint (SSE for
  the streamed answer + sources), and `POST /api/recordings/:id/clip`.
- and/or a Unix-domain-socket transport in `phoneme-ipc` with a documented,
  stable socket path (e.g. `$XDG_RUNTIME_DIR/phoneme-daemon.sock`).

Until then ytnt branches on OS (`phoneme_pipe_path()` in src-tauri/src/lib.rs)
and shows a clear "only on Windows for now" notice instead of a silent no-op.

## 3. A documented, versioned contract + compat signal

ytnt parses `--json` CLI output and a couple of REST/pipe shapes. To detect a
drifted/old contract it currently shells `phoneme version` (main.rs:67 prints
`phoneme X.Y.Z`) and compares against a hardcoded minimum.

Asks:
- A documented, versioned `--json` / REST contract (semver or a contract
  integer) ytnt can pin against.
- A `version` field on `GET /api/status` (the IPC `DaemonStatus` Ok already
  carries `version` — schema.rs ~1317; the `Handshake` request also returns
  `{protocol_version, app_version, compatible}` — schema.rs ~1344). Surfacing
  `version` over REST `/api/status` would let the REST-only (cross-platform)
  path do the same compat check the CLI path does.

## Notes / non-asks (already fine)

- Chapters: `GET /api/recordings/:id/chapters` → `GetChapters` (request_map.rs:90)
  and CLI `phoneme --json chapters <id> --show` both work read-only. ytnt uses
  the CLI `--show` form so it never triggers LLM generation.
- Segments: `phoneme --json show <id> --segments` and
  `GET /api/recordings/:id/segments` both fine.
- Live events: `GET /api/events` SSE (sse.rs) mirrors the pipe `SubscribeEvents`
  stream — ytnt can use it for live pipeline progress where phoneme-rest is up.
