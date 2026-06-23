# Competitive Landscape

Researched June 2026. This is a crowded space, so positioning matters more than features. The
recurring pattern: **everyone is either a browser extension or a cloud web app.** Native, local-first,
open-source desktop is empty.

## The field

### Manual, timestamp-first (closest in spirit)

- **YiNote** — Free browser extension, manual timestamped notes across YouTube/Vimeo/Bilibili. Clean,
  no AI, no cloud. The spiritual ancestor of this app — but it's a sandboxed extension and effectively
  unmaintained. *Gap we fill: a maintained, native, extensible version.*
- **Obsidian Timestamp Notes / Media Notes** — Open-source Obsidian plugins. Keyboard timestamping,
  clickable timestamps, some do screenshots. Excellent — *if you already live in Obsidian.* Locked to
  that one app. *Gap we fill: standalone, not Obsidian-dependent, but exports to it.*

### Deep-learning / multi-platform

- **ReClipped** — Extension + cloud. Goes beyond YouTube (Coursera, Udemy, LinkedIn Learning), captures
  text notes, video highlights, screenshots; exports PDF/Markdown; syncs Notion/Readwise/Evernote. The
  most feature-complete competitor. *Closed source, account + cloud, fixed sync targets.*

### AI summarizers (adjacent, different job)

- **HoverNotes** — Chrome extension, AI timestamped notes, saves Markdown to an Obsidian vault, does
  timestamped screenshots (works because an extension can read the same-origin video element — we can't
  from an iframe; see ARCHITECTURE).
- **LunaNotes** — Extension, YouTube-only, AI notes + chat-with-video + auto-pause-on-type.
- **Glasp** — Extension, AI summaries + transcript side-panel + social sharing.
- **Taskade / NoteGPT / Eightify / SkyScribe** — Cloud apps that turn a transcript into a
  summary/flashcards/structured project, export to Notion/Obsidian.

These mostly answer "summarize this for me," not "let me take my own notes well." Different product.

## What everyone shares (the openings)

| Limitation | Who has it | Our answer |
|------------|-----------|------------|
| Browser extension — sandboxed, breaks on YouTube DOM changes, no local-tool access | YiNote, ReClipped, HoverNotes, LunaNotes, Glasp | Native Tauri desktop app |
| Cloud account — your notes on their server | ReClipped, LunaNotes, Glasp, Taskade, NoteGPT | Local SQLite, no account |
| Closed source | ReClipped, HoverNotes, LunaNotes, Glasp, most AI tools | MIT/Apache OSS |
| Fixed export targets | ReClipped (Notion/Readwise/Evernote) | Documented pluggable integration seam |
| AI is mandatory / cloud-only | LunaNotes, Glasp, Taskade, NoteGPT | AI optional, and *local* via Phoneme |

## Positioning

> The native, local-first, open-source desktop app for timestamped YouTube notes — with a pluggable
> integration seam so transcription, search, and export come from tools you choose (and own).

Three things no single competitor combines:

1. **Native desktop, not an extension.** Keyboard-first capture that never fights the page; survives
   YouTube's DOM churn; can talk to local daemons and vaults directly.
2. **Local-first and open.** One SQLite file you own, no account, MIT/Apache. The YiNote ethos, maintained.
3. **Extensible by design.** Phoneme (local Whisper transcription + semantic search + RAG + hook-based
   PKM export) is the flagship integration, but the seam is documented so the community can add Notion,
   Logseq, Readwise, or another transcription backend without forking the core.

## What we deliberately don't chase

- **Cloud AI summaries** — the summarizer crowd owns this; it's a different product and a treadmill.
- **Multi-platform video** (Udemy/Coursera) — ReClipped's turf; revisit only if demanded (ROADMAP P5).
- **Ad-blocking / downloading** — ToS landmines and not our job (see ARCHITECTURE constraints).

## Sources

- [Best Video Annotation and Timestamped Note-Taking Apps 2026 — VidNotes](https://vidnotes.app/blog/173-Best-Video-Annotation-and-Timestamped-Note-Taking-Apps-2026)
- [5 Apps to Take Time-Stamped Notes on YouTube — MakeUseOf](https://www.makeuseof.com/time-stamped-notes-youtube-learning-courses/)
- [11 Best YouTube to Notes AI Tools 2026 — Taskade](https://www.taskade.com/blog/youtube-to-notes)
- [Best Obsidian Plugins for Video Note-Taking — HoverNotes](https://hovernotes.io/en/blog/obsidian-video-plugin)
- [obsidian-media-notes — GitHub](https://github.com/jemstelos/obsidian-media-notes)
- [ReClipped Alternatives — AlternativeTo](https://alternativeto.net/software/reclipped/)
- [5 Best Chrome Extensions for YouTube Note-Taking — MensorAI](https://www.mensorai.com/blog/best-chrome-extensions-youtube-note-taking)
