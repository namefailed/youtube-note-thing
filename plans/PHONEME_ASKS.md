# Asks to Phoneme

Things ytnt (youtube-note-thing) would benefit from Phoneme exposing. ytnt is a
thin, best-effort client: it works fully with no Phoneme installed and every
Phoneme call degrades gracefully.

**Status:** most asks were resolved in Phoneme commit `e8dbd56d`
*("integration surfaces for companion apps — versions REST+CLI, clip REST,
contract doc")*. Remaining items were deferred by Phoneme on purpose. Verified
against Phoneme source 2026-06-23.

## ✅ Resolved

- **Transcript versions, cross-platform.** Was named-pipe-only (Windows). Now:
  - CLI `phoneme versions <id>` (+ `--json`) — `bin/phoneme/src/commands/versions.rs`.
  - REST `GET /api/recordings/:id/versions` — `server.rs:132`.
  ytnt now resolves versions **CLI-first → REST → pipe** (`phoneme_versions` in
  `src-tauri/src/lib.rs`), so the Compare view works on macOS/Linux too — the
  Windows-only pipe is just a last resort.
- **Audio clip export over REST.** `POST /api/recordings/:id/clip`
  `{start_ms,end_ms[,out_path]}` → `{path}` — `server.rs:133`. (Not yet surfaced
  in ytnt — see "Open / not yet wired".)
- **Versioned contract + compat signal.** `GET /api/status` reports the daemon
  `version`; the full CLI/REST/pipe contract is documented in
  `docs/dev/integration-api.md`. ytnt's probe checks `phoneme version`.

## ⏸ Deferred by Phoneme (intentional — tracked in its integration-api doc)

- **`POST /api/import {url}`** — import stays CLI-only because the yt-dlp pipeline
  lives in the CLI and `phoneme import <url>` already works cross-platform. ytnt
  keeps its one CLI spawn for import; no blocker.
- **RAG Ask over REST (streaming)** — `Ask` / `AskActivity` remain pipe-only
  (CLI `phoneme ask` streams over the pipe). So an in-app Ask/Q&A feature would be
  Windows-only today; ytnt leaves it unbuilt until a REST/SSE Ask endpoint exists.

## Open / not yet wired in ytnt (no Phoneme change needed)

- **Clip** — the REST route exists; ytnt could add a "clip this range" action
  (cross-platform) whenever we want it. Not built yet (avoid dead UI).

## Already fine (no ask)

- Chapters: `GET /api/recordings/:id/chapters` + CLI `phoneme --json chapters <id> --show`.
- Segments: `phoneme --json show <id> --segments` + `GET /api/recordings/:id/segments`.
- Live events: `GET /api/events` SSE mirrors the pipe `SubscribeEvents` stream.
