# 🎬 Getting started

**youtube-note-thing** (ytnt) is a local-first desktop app for taking timestamped notes on YouTube videos. You paste a link, the video plays right inside the app, and every note you capture remembers the exact moment it belongs to — so a quick scan of your notes is enough to jump back to any point. Your library, your notes, and your settings all live on your own machine; nothing is uploaded anywhere by default.

This page gets you from a fresh checkout to your first timestamped note. The two optional integrations — [your YouTube account](youtube_account_and_playlists.md) and [Phoneme transcripts](phoneme_integration.md) — are covered on their own pages and aren't needed here.

> [!NOTE]
> ytnt is Windows-first (it needs **WebView2**, which ships with Windows 11). It runs anywhere Tauri does, but the command examples below use **PowerShell**.

---

## 🛠️ Install and run

There aren't packaged installers yet, so for now you run ytnt from source in dev mode. You'll need:

| Prerequisite | Why |
| --- | --- |
| **Node.js** | Runs the Vite dev server and the frontend build. |
| **Rust toolchain** | Compiles the Tauri backend. |
| **Tauri v2 prerequisites** | Platform build dependencies — on Windows that means **WebView2** (preinstalled on Windows 11). |

Once those are in place, from the repository root:

```powershell
npm install
npm run tauri dev
```

`npm run tauri dev` starts the Vite dev server on port `5191` and opens the desktop window. The first run is slow because Rust compiles from scratch; later runs are quick. Leave the command running while you work — it hot-reloads the frontend as you edit.

> [!TIP]
> To make a release build instead, run `npm run tauri build`. See [Building from source](../developer-guide/building_from_source.md) for the full toolchain setup and the quality gates (`npm run type-check`, `npm test`, `cargo check`).

---

## 🧭 The three-pane layout

When the window opens you'll see a top bar and three columns:

| Pane | What it holds |
| --- | --- |
| **Filters** (left) | Collapsible **Library**, **Tags**, and **Playlists** sections that narrow what the middle pane shows. |
| **Library** (middle) | A card per video — thumbnail, title, channel, view count, publish date, duration, note count, and tags. |
| **Detail** (right) | The video player for the selected card, plus its notes (and the transcript view if you use Phoneme). |

Across the **top bar**, left to right: a **filters** toggle, a **library** toggle, the **link box** ("Paste a YouTube video or playlist link…") with its **Load** button, a **search** button, a **settings** gear, and a small status dot for [Phoneme](phoneme_integration.md).

You can hide either side column to give the player more room:

- Press `Ctrl + B` to toggle the **Filters** pane.
- Click the **library** toggle in the top bar to hide or show the **Library** pane.
- In the detail header, click the **Fullscreen the video panel** button (the expand icon) to collapse both side columns at once, then click it again to bring them back.

The panes you collapse are remembered between sessions.

---

## ▶️ Add your first video

1. Click the **link box** in the top bar.
2. Paste a YouTube link or just the 11-character video ID. Any of these work:
   - `https://www.youtube.com/watch?v=VIDEO_ID`
   - `https://youtu.be/VIDEO_ID`
   - a `shorts/`, `embed/`, `v/`, or `live/` URL
   - the bare `VIDEO_ID`
3. Press `Enter` or click **Load**.

The video is added to your **Library** and starts loading in the **Detail** pane. From then on, clicking its card in the Library reopens it instantly.

> [!NOTE]
> Paste a **playlist** link (one containing `list=`) and ytnt imports every video into your library at once. Connecting your account unlocks browsing your own playlists in the sidebar — see [YouTube account & playlists](youtube_account_and_playlists.md).

If the link isn't a valid YouTube video or playlist, you'll get a **Not a valid YouTube URL** message and nothing is added.

---

## 🎞️ The player

The player is the real YouTube player embedded in the app, so playback quality and captions behave exactly as they do on YouTube. The catch: most controls are driven by keyboard so your hands stay on the keys while you take notes. These work whether or not the video has focus:

| Keys | Action |
| --- | --- |
| `Space` or `K` | Play / pause |
| `J` / `L` | Back / forward 10 seconds |
| `←` / `→` | Back / forward 5 seconds (hold `Shift` for 30) |
| `+` / `−` | Playback speed up / down (in 0.25× steps) |
| `M` | Mute / unmute |
| `F` | Fullscreen the video |
| `0`–`9` | Jump to 0%–90% of the video |

> [!TIP]
> Press `?` anywhere to pop up the in-app keyboard cheat sheet, or see the full [Keyboard shortcuts](keyboard_shortcuts.md) reference. In fullscreen, the title bar's own fullscreen control is hidden so ytnt's note overlay can sit on top — see [Appearance & window](appearance_and_window.md).

---

## 📝 Take your first timestamped note

This is the whole point of ytnt — capturing a thought without losing your place.

1. Play the video until you reach a moment worth noting.
2. Press `Alt + N` (or click **Add note** under the player).
3. Type your note in the editor that appears and press `Enter` to save (or `Esc` to cancel).

Two behaviors make this feel effortless, and both are on by default:

- **Capture offset** — the note's timestamp lands a few seconds *before* your keypress, so you don't miss the moment you were reacting to. The default is **3 seconds** (configurable `0`–`30`).
- **Auto-pause** — the video pauses the instant you start a note and resumes when you save or cancel, so you can type without the video running away from you.

Both live under **Settings → Capture**:

| Setting | Default | What it does |
| --- | --- | --- |
| **Auto-pause when adding a note** | On | Pauses playback while you type a note; resumes on save/cancel. |
| **Capture offset (seconds)** | `3` (range `0`–`30`) | How far before your keypress the note's timestamp is placed. |

Each saved note shows its timestamp in the notes list. Click that timestamp to seek the player straight to that moment. You can reorder notes, copy a note's timestamp link, search across all notes (`/`), and export to Markdown — all covered in [Taking notes](taking_notes.md).

---

## ⏯️ Resume where you left off

ytnt continuously remembers your position in each video. When you reopen a video later, it loads **paused at the point you stopped watching** rather than at the start — hit `Space` to pick up exactly where you were. Switching between videos always cues the next one at its own resume point; nothing auto-plays until you press play.

---

## 💾 Where your data is stored

Everything ytnt records about your videos and notes lives in a single SQLite database on your machine:

```
%APPDATA%\dev.ytnt.app\ytnt.db
```

`dev.ytnt.app` is ytnt's bundle identifier (defined in `src-tauri/tauri.conf.json`). That one file holds your videos, all your notes (with full-text search), playlist membership, and cached video metadata. Back it up by copying it, or use the in-app **Export JSON** / **Import JSON** buttons for a portable JSON snapshot.

App **settings** (offset, auto-pause, theme, vault folder, and the rest) aren't in the database — they live in your browser `localStorage` under the key `ytnt.settings`, alongside `ytnt.tagColors` (your tag color picks) and `ytnt.tagSyncBase` (tag-sync snapshots). Settings changes take effect immediately, with no restart. See the full [Settings reference](settings_reference.md).

> [!CAUTION]
> Deleting `ytnt.db` removes every video and note permanently. Make a copy of the file first if you might want any of it back.

---

## ✅ Next steps

- [Taking notes](taking_notes.md) — go deeper on the capture offset, auto-pause, reordering, search, find & replace, and Markdown export.
- [Library & filters](library_and_filters.md) — the three-pane layout in detail, pinning, multi-select, bulk actions, and full-text note search.
- [Tags](tags.md) — organize videos with colored tags, the palette, sidebar dots, and the Tag Manager.
- [Keyboard shortcuts](keyboard_shortcuts.md) — the complete hotkey reference.
- [Appearance & window](appearance_and_window.md) — themes, strip-titlebar mode, and fullscreen with the note overlay.
- [YouTube account & playlists](youtube_account_and_playlists.md) — sign in to browse playlists and pull richer video metadata.
- [Phoneme integration](phoneme_integration.md) — optional transcripts, summaries, and two-way tag sync.
- [Troubleshooting](troubleshooting.md) — if something isn't working.
