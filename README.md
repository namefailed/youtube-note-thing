# youtube-note-thing

**A native, local-first desktop app for taking timestamped notes on YouTube videos.**

Paste a URL, watch the video, hit a key — your note is pinned to that exact second. Click any
timestamp to jump back. Your notes live in a local SQLite file you own, and export to plain
Markdown or your PKM of choice. No account, no cloud, no tracking.

**Status:** Working **v1** (Tauri 2 + Lit + sqlx). See [`plans/`](plans/) for design docs.

## Develop

Prereqs: Node 18+, Rust (stable), and your platform's [Tauri prerequisites](https://tauri.app/start/prerequisites/) (WebView2 on Windows).

```bash
npm install
npm run tauri dev     # dev window (Vite serves on port 5191)
npm test              # unit tests (vitest)
npm run tauri build   # production installer (.msi on Windows)
```

## What works today

Embedded player · timestamped capture (`Alt+N`, configurable pre-roll offset, auto-pause) · click-to-seek ·
marker timeline · keyboard transport (`Space`, `←/→`, `±` speed) and note nav (`↑/↓`, `Enter`, `Delete`) ·
searchable/taggable library with thumbnails · FTS5 full-text search · inline edit · reorder · resume ·
Markdown rendering · **export** (copy/download `.md`, save to a vault folder, JSON backup/restore) ·
custom dark titlebar · local SQLite you own.

---

## Why another one?

Taking notes on YouTube is a crowded space — but look at *what* the competition is:

| Tool | Shape | Local-first | Open source | Extensible |
|------|-------|-------------|-------------|------------|
| YiNote | browser extension | ✅ | partly | ❌ (unmaintained) |
| ReClipped | extension + cloud | ❌ | ❌ | sync to fixed services |
| HoverNotes / LunaNotes / Glasp | extension + cloud AI | ❌ | ❌ | ❌ |
| Obsidian Media Notes / Timestamp Notes | Obsidian plugin | ✅ | ✅ | Obsidian-only |
| **This app** | **native desktop** | ✅ | ✅ | **pluggable integrations** |

Almost everyone ships a **browser extension** (sandboxed, fragile against YouTube's DOM, can't
talk to your local tools) or a **cloud web app** (your notes on someone else's server). The Obsidian
plugins are great — if you already live in Obsidian.

Nobody owns **native desktop + local-first + open-source + a documented integration seam.** That's
the wedge. A desktop app can do what an extension can't: keyboard-first capture that never fights the
page, a database you own, and direct connections to local daemons and vaults — including
[Phoneme](https://github.com/namefailed/phoneme) for on-device transcription, semantic search, and
RAG. See [COMPETITORS.md](plans/COMPETITORS.md) for the full landscape.

## What it is (and isn't)

**Is:** a focused, keyboard-driven note-taker bolted to a YouTube player, that you run locally and
own completely.

**Isn't:** an ad-blocker, a video downloader, or a cloud AI summarizer. It embeds the official
YouTube player (ads included — see [Constraints](#honest-constraints)) and does its own job well
instead of half a dozen jobs badly.

## Core features (standalone — no integration required)

- **Embedded YouTube player** with full playback control via the IFrame API
- **Timestamped notes** — a hotkey captures the current second; optional auto-pause while you type
- **Click-to-seek** — click any timestamp to jump the video there
- **Custom marker timeline** — your notes shown as dots along a seek bar
- **Video library** — searchable, taggable list of everything you've notted
- **Local full-text search** across all your notes (SQLite FTS5)
- **Markdown export** — write `.md` files you own, or push to an Obsidian vault
- **Local-first** — one SQLite file, no account, no telemetry
- **Cross-platform** — Windows, macOS, Linux (Tauri)

## Optional integrations

The app works fully without any of these. When present, they light up:

- **[Phoneme](https://github.com/namefailed/phoneme)** (flagship) — send a video to Phoneme for
  on-device Whisper transcription, then read back the transcript, auto-chapters, semantic search,
  and grounded Q&A. Phoneme also handles YouTube audio download (yt-dlp) and PKM export via its
  hooks, so this app never has to.
- **Markdown / Obsidian** — built in, no integration needed.
- **Community adapters** — the integration interface is documented; Notion, Logseq, Readwise, and
  others can be added without touching the core. See [INTEGRATIONS.md](plans/INTEGRATIONS.md).

## Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Tauri v2 (Rust backend) |
| Frontend | Lit + CodeMirror, TypeScript, Vite (matches Phoneme) |
| Styling | Lit scoped CSS (matches Phoneme) |
| Player | YouTube IFrame Player API |
| Storage | SQLite via `sqlx`, FTS5 — reuses Phoneme's catalog layer |
| State | Lit reactive stores |

## Honest constraints

These are real and called out so nobody is surprised:

- **No ad-blocking.** The embedded IFrame player serves ads; that's Google's call, not ours.
- **No in-video screenshots from the player.** The YouTube player is a cross-origin iframe — its
  frames can't be read to a canvas. Screenshots, if built, must use OS window-capture (a separate,
  best-effort feature), not the player.
- **Transcripts are an integration, not a core promise.** Standalone, the app shows YouTube's own
  captions when available. Reliable transcription comes from connecting Phoneme (or another backend).

## License

MIT OR Apache-2.0 (matching Phoneme).
