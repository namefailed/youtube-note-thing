# youtube-note-thing Documentation

Complete documentation for **users** and **developers**. **ytnt** is a local-first desktop app for taking timestamped notes on YouTube videos — your library, your notes, and your settings live on your own machine. [Phoneme](https://github.com/) integration (transcripts, summaries, tag sync) is entirely **optional**.

---

## Quick links

| I want to… | Start here |
| --- | --- |
| Install and take my first note | [Getting started](user-guide/getting_started.md) |
| Connect my YouTube account and browse playlists | [YouTube account & playlists](user-guide/youtube_account_and_playlists.md) |
| Use Phoneme for transcripts and summaries | [Phoneme integration](user-guide/phoneme_integration.md) |
| Organize videos with colored tags | [Tags](user-guide/tags.md) |
| Learn the keyboard shortcuts | [Keyboard shortcuts](user-guide/keyboard_shortcuts.md) |
| Fix something that's broken | [Troubleshooting](user-guide/troubleshooting.md) |
| Build from source or contribute code | [Contributing](../CONTRIBUTING.md) |

---

## User guide

### First steps

- [Getting started](user-guide/getting_started.md) — install, open your first video, and capture a note.
- [Settings reference](user-guide/settings_reference.md) — every setting in `ytnt.settings` and where it's stored.

### Capture

- [Taking notes](user-guide/taking_notes.md) — timestamped notes, the capture **offset**, **auto-pause**, and resume position.
- [Keyboard shortcuts](user-guide/keyboard_shortcuts.md) — the full hotkey reference for playback and note capture.

### Organize & export

- [Library & filters](user-guide/library_and_filters.md) — the 3-pane layout, library cards, pinning, multi-select, bulk actions, and FTS note search.
- [Tags](user-guide/tags.md) — colored tags, the color picker and palette, sidebar dots, and the Tag Manager.
- [YouTube account & playlists](user-guide/youtube_account_and_playlists.md) — Google sign-in, browsing playlists, toggling videos in and out of your library, and pulling video metadata.

### Integrate

- [Phoneme integration](user-guide/phoneme_integration.md) — send a video to transcribe, view transcripts and summaries, compare versions, and sync tags both ways.

### Polish

- [Appearance & window](user-guide/appearance_and_window.md) — themes (the Catppuccin family and more), strip-system-titlebar mode, and fullscreen with the in-fullscreen note overlay.
- [Troubleshooting](user-guide/troubleshooting.md) — common problems and how to recover.

---

## Developer guide

### Architecture

- [Architecture](developer-guide/architecture.md) — how the **Tauri** Rust backend, the single **Lit** web component, and **SQLite** fit together.
- [Frontend guide](developer-guide/frontend_guide.md) — the `src/app.ts` component, `src/api.ts` invoke wrappers, `src/lib.ts` helpers, and `src/player.ts` YouTube IFrame wrapper.
- [Backend guide](developer-guide/backend_guide.md) — Tauri commands and the `src-tauri/src/{lib.rs,db.rs,main.rs}` layout.

### Data

- [Data model & migrations](developer-guide/data_model_and_migrations.md) — the `videos`, `notes`, `notes_fts`, and playlists tables, plus the immutable-migration rule.

### Integration

- [Integrations](developer-guide/integrations.md) — `resolve_phoneme()` (CLI-first, REST fallback), the `ext_ref` link format, the 3-way tag merge, and Google loopback OAuth.

### Build & quality

- [Building from source](developer-guide/building_from_source.md) — prerequisites and the `npm run tauri dev` / `tauri build` workflow.
- [Testing & verification](developer-guide/testing_and_verification.md) — `npm run type-check`, `npm test`, and `cargo check` / `cargo test`.

### Extending

- [How to extend](developer-guide/how_to_extend.md) — recipes for adding a Tauri command, a setting, or a new migration.

### Contributing

- [Contributing](../CONTRIBUTING.md) — fork-and-branch workflow, commit conventions, and the pre-PR checklist.

---

## Documentation conventions

- **Windows-first.** Command examples use **PowerShell** fences; ytnt's primary platform is Windows (WebView2 required).
- **Paths.** The SQLite database lives at `%APPDATA%/<bundle-identifier>/ytnt.db`, where the identifier is set in `src-tauri/tauri.conf.json`. Migrations live in `src-tauri/migrations/`.
- **Settings.** App settings are stored in the browser `localStorage` key `ytnt.settings`; tag color overrides in `ytnt.tagColors`; tag-sync snapshots in `ytnt.tagSyncBase`. Changes take effect within the running app — no restart needed.
- **Phoneme is optional.** Every Phoneme feature degrades gracefully when no Phoneme binary or server is available; ytnt never depends on it to run.
- **Links.** Sibling docs are cross-linked with relative paths from this file (`user-guide/…`, `developer-guide/…`, `../CONTRIBUTING.md`).
