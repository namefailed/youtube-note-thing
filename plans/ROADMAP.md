# Roadmap

Solo, part-time, polished-OSS bar. No week estimates — they'd be fiction. Phases are ordered by
dependency and shipped as tagged releases. **The rule: every phase up to P3 produces something fully
usable with zero integrations installed.** Integrations come *after* the standalone app is good, never
as a crutch for it.

## Status — 2026-06-23

A working **v1** standalone build exists (Tauri 2 + Lit + sqlx, three-table schema). **Done:** P0 (scaffold,
player, metadata from the player so no API key) and P1 (capture loop, click-to-seek, marker timeline,
library + thumbnails, FTS5 search, filter, inline edit, reorder, keyboard nav + transport, resume,
Markdown + JSON export). **P2 partial:** Markdown-to-folder ("Save to vault"), custom titlebar, theming,
real icon, player error handling, unit tests — shipped; **Obsidian REST adapter, backup-on-launch, and a
full a11y pass are deferred.** **P3+ (Phoneme integration, transcripts) not started** — held until the
standalone app is exercised and Phoneme dev frees up.

## P0 — Scaffold & player
*Deliverable: paste a URL, video plays, time is tracked.*

- **Fork Phoneme's skeleton** (Tauri v2 + CI + installer + signing + icon pipeline); strip the audio crates. Frontend: reuse Phoneme's **Lit + CodeMirror + scoped CSS**. ESLint/Prettier/strict TS.
- CI early (GitHub Actions: lint, typecheck, build) — gates everything after.
- Frameless window shell.
- YouTube IFrame embed; verify `getCurrentTime()` / `seekTo()` work in the webview.
- Error 153 → "open in browser" fallback.
- SQLite via **sqlx** (WAL), reusing Phoneme's catalog + migration runner; the three-table schema.
- Metadata via **oEmbed** (no API key).

## P1 — The note loop (the actual product)
*Deliverable: watch, capture timestamped notes, jump back, manage a library.*

- `useVideoPlayer` with the time-in-a-ref design; capture latency < 100 ms.
- Capture flow: hotkey → auto-pause → prefilled timestamp → inline editor → auto-resume.
- NoteCard / NoteList (virtualized > 100); click-to-seek.
- Custom marker timeline.
- Library sidebar with note counts; per-video tags (JSON column).
- Note full-text search (FTS5).
- Delete with undo toast; auto-save on blur.
- **Markdown-files export** (the universal fallback) + **JSON library export/import** (portable backup).
- Resume playback (`last_pos_secs`) + timestamp-offset capture (borrowed from Obsidian Media Notes).
- Keyboard nav end to end.

## P2 — Polish & Obsidian
*Deliverable: feels finished; exports to Obsidian.*

- Built-in Obsidian export (Local REST API; key in OS keychain).
- Dark/light theme (system-aware); rebindable shortcuts UI.
- Global search overlay.
- Accessibility pass (keyboard, ARIA, contrast, reduced-motion) — see [UX](UX.md).
- DB backup on launch + `integrity_check` auto-restore.
- Error boundaries on every region; rotating log file.

## P3 — Integration seam + Phoneme
*Deliverable: optional superpowers, app still great without them.*

- The `Integration` seam: probe, capabilities, single dispatch (see [INTEGRATIONS.md](INTEGRATIONS.md)).
- Frontend renders integration UI only when present.
- **Phoneme adapter:** `phoneme import <url>` → store `ext_ref`; SSE progress; transcript + chapters
  panel via REST; merge `/api/search` into global search.
- Standalone fallback: YouTube captions when available, else a "connect a backend" hint.

## P4 — Release
*Deliverable: v1.0, public.*

- **Name:** shipping as `youtube-note-thing` for now (public and internal). Revisit a real name later if wanted.
- Root README polish, screenshots, CONTRIBUTING, CHANGELOG (mirror Phoneme's structure).
- Windows code signing; macOS signing + notarization (start Apple enrollment early — it's slow).
- Tauri updater.
- GitHub release with installers.

## P5 — Later (demand-driven, no commitment)

- More integrations through the seam: Notion, Logseq, Readwise, an alternative transcription backend.
- Phoneme RAG (`Ask`) and audio-clip export — once a REST route or named-pipe path is wired.
- Import from YiNote / other tools' JSON.
- Playlist / Liked-videos import (needs the optional Data API key).
- Multi-platform video (Vimeo, then maybe Udemy/Coursera) — only if asked for.
- Tauri mobile.

## Risk register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| YouTube IFrame Error 153 / embed restrictions | Medium | Detect on load → open-in-browser fallback |
| YouTube changes its caption endpoint | High | Captions are best-effort; reliable transcription is the Phoneme integration, not the core |
| Tauri v2 bundling / WebView2 / signing pain | Medium | Buffer time; CI builds early; document WebView2 bootstrap |
| Crowded market, weak differentiation | Medium | Lean on the wedge: native + local-first + OSS + pluggable (see [COMPETITORS](COMPETITORS.md)) |
| Seam over-engineered before a 2nd integration exists | Medium | Keep it one dispatch `match`; no plugin framework until a real 3rd backend demands it |
| Scope creep (the deferred mode-zoo) | High | P5 is demand-driven; say no until the core loop is loved |
