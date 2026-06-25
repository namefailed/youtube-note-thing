<p align="center">
  <em>Screenshot coming soon — the app is a 3-pane desktop window (filters sidebar · video list · video + notes detail).</em>
</p>

<p align="center">
  <!-- Badges land here once CI and releases are public: build status · downloads · license -->
  <strong>MIT OR Apache-2.0</strong> · <strong>Local-first</strong> · <strong>No cloud · No telemetry</strong>
</p>

# 🎬 youtube-note-thing

**Local-first desktop notes pinned to the exact second of any YouTube video.**

Paste a URL, watch, hit a key — your note is stamped to that moment. Click any timestamp to jump back.

100% offline-by-default. Your notes live in a SQLite file you own — no account, no cloud, no telemetry.

---

## 🧭 Philosophy

| Principle | What It Means |
|-----------|---------------|
| **🔒 Local-first** | Every note lives in one **SQLite** file on your machine. No sign-up, no sync server, nothing phones home. |
| **🪶 Keyboard-first** | Capture, seek, navigate, and search without leaving the keyboard — `Alt+N` stamps a note at the current second. |
| **🔌 Optional integrations** | The app is complete on its own. [**Phoneme**](https://github.com/namefailed/phoneme) transcription and your YouTube account plug in when you want them — and stay out of the way when you don't. |

---

## ✨ Highlights

- **🎯 Timestamped notes**: `Alt+N` captures the current second (with a configurable pre-roll `offset` and optional **auto-pause** while you type). Click any timestamp to seek the video right back to it.
- **⌨️ Keyboard transport**: `Space`/`K` play-pause, `J`/`L` jump ±10s, `←`/`→` nudge ±5s (`Shift` = 30s), `+`/`−` change speed, `M` mute, `F` fullscreen, `0`–`9` seek to 0–90%.
- **🗂️ 3-pane library**: a **filters sidebar**, a **video list**, and a **detail pane**. Library cards surface channel, view count, publish date, and duration without covering the title.
- **📌 Bulk actions**: **pin** videos, `Shift+click` to multi-select, then tag or act on the whole selection at once.
- **🔎 Full-text search**: `/` opens search across every note, powered by **SQLite FTS5**. **Find & replace** rewrites note text in place.
- **🏷️ Colored tags**: filter by **all / has-transcript / tagged / untagged / by-tag**, manage tags in the **Tag Manager**, and pick colors from a palette — matching **Phoneme**'s tag look.
- **📤 Import & export**: render and copy/download **Markdown**, save `.md` straight into a vault folder, or back up and restore the whole library as **JSON**.
- **🎨 Themes & window**: Catppuccin family and friends, plus a **strip-system-titlebar** mode for a cleaner frame.
- **🖥️ Fullscreen with overlay**: go fullscreen on the video and keep an in-fullscreen **note overlay** for capture without breaking focus.
- **▶️ Resume position**: each video remembers where you left off.
- **🔣 Phoneme integration** *(optional)*: send a video to **Phoneme** for on-device transcription, then read the transcript, compare versions, view summary and chapters, and keep tags in **bidirectional sync**.
- **📺 YouTube account** *(optional)*: connect via Google to browse playlists, toggle videos in and out of your library, remove a video from a playlist, and pull view-count/metadata.

---

## 🚀 Quick start

**Prerequisites**

- **Node** (with `npm`)
- **Rust** toolchain (stable)
- **Tauri v2** prerequisites for your OS — **WebView2** on Windows (the primary platform). See the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).

**Run it**

```powershell
npm install
npm run tauri dev     # dev window; Vite serves the frontend on port 5191 (strictPort)
```

**Build an installer**

```powershell
npm run tauri build   # production bundle (.msi on Windows)
```

---

## 📸 Screenshots

No screenshots are bundled yet. To see the app for yourself, run `npm run tauri dev` — you'll get the 3-pane window described above. Captures will be added to the docs once the UI settles.

---

## 📚 Documentation

**[Full documentation index →](docs/README.md)**

### Users

| Guide | Topic |
|-------|-------|
| [Getting started](docs/user-guide/getting_started.md) | Install, add your first video, take your first note |
| [Taking notes](docs/user-guide/taking_notes.md) | Capture, offset, auto-pause, click-to-seek, edit, reorder |
| [Library & filters](docs/user-guide/library_and_filters.md) | The 3-pane layout, cards, pinning, bulk select, filters |
| [Tags](docs/user-guide/tags.md) | Colored tags, the Tag Manager, palettes |
| [YouTube account & playlists](docs/user-guide/youtube_account_and_playlists.md) | Google OAuth, browse playlists, metadata sync |
| [Phoneme integration](docs/user-guide/phoneme_integration.md) | Transcripts, chapters, summary, tag sync |
| [Keyboard shortcuts](docs/user-guide/keyboard_shortcuts.md) | The full `?` cheat sheet |
| [Appearance & window](docs/user-guide/appearance_and_window.md) | Themes and strip-titlebar mode |
| [Settings reference](docs/user-guide/settings_reference.md) | Every setting and where it's stored |
| [Troubleshooting](docs/user-guide/troubleshooting.md) | When something isn't working |

### Developers

| Guide | Topic |
|-------|-------|
| [Architecture](docs/developer-guide/architecture.md) | How the Tauri shell, frontend, and DB fit together |
| [Building from source](docs/developer-guide/building_from_source.md) | Toolchain, dev server, installers |
| [Frontend guide](docs/developer-guide/frontend_guide.md) | The Lit component, `api.ts`, `lib.ts`, `player.ts` |
| [Backend guide](docs/developer-guide/backend_guide.md) | The Rust commands in `src-tauri/src/` |
| [Data model & migrations](docs/developer-guide/data_model_and_migrations.md) | Tables, FTS, and the migration rules |
| [Integrations](docs/developer-guide/integrations.md) | Phoneme resolution and Google OAuth wiring |
| [Testing & verification](docs/developer-guide/testing_and_verification.md) | The gates that must pass before a PR |
| [How to extend](docs/developer-guide/how_to_extend.md) | Adding a command, a setting, or an integration |

See [`CONTRIBUTING.md`](CONTRIBUTING.md) before you open a pull request.

---

## 🔣 The Phoneme relationship

**youtube-note-thing** is a sibling to [**Phoneme**](https://github.com/namefailed/phoneme), a local transcription app — but the integration is **entirely optional**. The note-taker is complete on its own; Phoneme is not a dependency and the app never runs a daemon or keeps its own tag catalog.

When Phoneme is present, the app resolves it via `resolve_phoneme()` — an override setting (`phonemeBin`) or the `PHONEME_BIN` environment variable, then `PATH`, then a local dev build — and talks to it **CLI-first with a REST fallback**. From there you can:

- **Send a video to transcribe**, then read its transcript, compare versions, and view summary and chapters.
- **Sync tags both ways.** Phoneme is the tag-catalog authority; the app mirrors colors and membership via a 3-way merge (`mergeTagSets` in `src/lib.ts`) against a per-video base snapshot in `localStorage`. No daemon, no catalog on this side.

An external link is recorded in `videos.ext_ref` as JSON, e.g. `{"integration":"phoneme","ref":"<id>"}`.

---

## 🧱 Tech stack

| Layer | Choice |
|-------|--------|
| **Shell** | **Tauri v2** — Rust backend in `src-tauri/src/{lib.rs,db.rs,main.rs}` |
| **Frontend** | A single **Lit 3** web component in `src/app.ts`, with typed invoke wrappers (`src/api.ts`), pure helpers (`src/lib.ts`), and a YouTube IFrame wrapper (`src/player.ts`) |
| **Build** | **Vite** + **TypeScript** (dev server on port 5191, strictPort) |
| **Player** | **YouTube IFrame Player API** |
| **Storage** | **SQLite** via **sqlx**, with **FTS5** full-text search; migrations in `src-tauri/migrations/` |
| **Settings** | `localStorage` key `ytnt.settings` (plus `ytnt.tagColors` and `ytnt.tagSyncBase`) |
| **YouTube account** | Installed-app loopback **Google OAuth** (`youtube` scope, read + write) |

The database lives at `%APPDATA%/dev.ytnt.app/ytnt.db`. Migrations are applied at startup via `sqlx migrate!`.

> **⚠️ Migration gotcha (devs):** sqlx checksums each migration by file bytes, so a committed migration is **immutable** — editing even a comment or line ending breaks every existing DB with `Migrate(VersionMismatch)`. `.gitattributes` marks `src-tauri/migrations/*.sql` as `-text` (git treats them as binary for line endings), so git never normalizes or converts their endings — the committed bytes, and therefore the sqlx checksums, stay stable. **To change the schema, add a new migration file** rather than editing an old one.

---

## 🤝 Contributing

Bug reports, fixes, and features are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the architecture overview, dev-environment setup, the pre-PR checklist (`npm run type-check`, `npm test`, and in `src-tauri/` `cargo check` / `cargo test`), and the commit-message convention.

---

## 📄 License

**MIT OR Apache-2.0.**

A local-first project by [namefailed](https://github.com/namefailed) — no accounts, no telemetry, no tracking.
