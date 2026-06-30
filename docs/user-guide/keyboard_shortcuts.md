# ⌨️ Keyboard shortcuts

ytnt is built to keep your hands on the keyboard while you watch and take notes — scrub the video, capture a timestamped note, jump between notes, and search, all without reaching for the mouse. This page is the complete, accurate reference for every shortcut the app listens for, grouped by what it controls.

> [!TIP]
> Press `?` anywhere (outside a text field) to pop the in-app cheat sheet. It lists the most common keys at a glance; this page is the full version, including the editor and modal keys the cheat sheet leaves out.

## How shortcuts are handled

A few rules govern when a key does something:

- **Text fields win.** While your cursor is in an `input`, `textarea`, or `select`, the global shortcuts below are suppressed so you can type freely — the only exceptions are the editor/modal keys that are scoped *to* that field (like `Esc` to cancel or `Ctrl + Enter` to save).
- **Modals capture the keyboard.** When the search, settings, find & replace, tag manager, or cheat-sheet overlay is open, playback and note-list shortcuts are disabled. `Esc` closes the open overlay; `Tab` cycles focus within it.
- **Transport keys need a loaded video.** Play/pause, seek, speed, mute, fullscreen, and the `0`–`9` seek keys only fire when a video is open in the detail pane.
- **Note-list keys need notes.** `↑`/`↓`/`Enter`/`Delete` act on the current video's note list and are ignored while you're editing a note.
- **Keyboard navigation is opt-in.** The app-wide nav layer — pane jumps and the `h`/`j`/`k`/`l` cursor — is off until you turn on **Arrow-key** and/or **Vim (hjkl)** navigation in *Settings → Motion & navigation*. With it on, the focused pane shows an accent rail and a small HUD, and `Esc` steps back out. See [Keyboard navigation](#keyboard-navigation) below.
- **The player keeps listening even when the video has focus.** Clicking the YouTube frame normally hands keyboard focus to the embed; ytnt quietly returns focus to the app and drives playback through the player's own API, so your shortcuts keep working either way.
- **The playback, note, and app keys are customizable.** Everything in the Playback, Note list, Note editor, and Global tables below is a *default* — rebind any of them, or switch the whole keymap preset (Default / YouTube / Vim), in *Settings → Keyboard shortcuts*. The navigation keys (`h`/`j`/`k`/`l`, the `G`-leader chords, `Esc`, `Tab`) and the `0`–`9` seek keys are fixed.

> [!NOTE]
> Shortcuts use the literal keys YouTube watchers already know (`K`, `J`, `L`, `M`, `F`, number-row seeking), so muscle memory carries over.

## Global

These work from anywhere outside a text field. `Ctrl + B` is special — it works **even while you're typing**, so you can collapse the sidebar mid-edit.

| Keys | Action |
| --- | --- |
| `Ctrl + N` | Add a note at the current playback moment |
| `/` | Open search across all notes |
| `?` | Open the keyboard-shortcuts cheat sheet |
| `Ctrl + B` | Toggle the filters sidebar (also fires while typing) |
| `Esc` | Close the open dialog / cancel the current action |

On macOS, `Cmd` substitutes for `Ctrl` in `Cmd + B`.

See [Taking notes](taking_notes.md) for what capture does (offset and auto-pause), and [Library and filters](library_and_filters.md) for the search and sidebar features.

## Playback

Active when a video is loaded. These talk to the player directly, so they work whether the app or the video frame has focus.

> [!IMPORTANT]
> If you've turned on [keyboard navigation](#keyboard-navigation), these YouTube-style keys only drive the player when you're **in** the video — fullscreen, or after you focus the player with `G` then `V` (press `Esc` to step back out). Everywhere else the keys move the cursor, so navigation is never hijacked by the player. With keyboard navigation **off**, the playback keys below are always live whenever a video is loaded.

| Keys | Action |
| --- | --- |
| `Space` or `K` | Play / pause |
| `J` | Jump back 10 seconds |
| `L` | Jump forward 10 seconds |
| `←` | Back 5 seconds (`Shift + ←` = 30 seconds) |
| `→` | Forward 5 seconds (`Shift + →` = 30 seconds) |
| `+` or `=` | Speed up (steps of 0.25×) |
| `-` or `_` | Slow down (steps of 0.25×) |
| `M` | Mute / unmute |
| `F` | Toggle fullscreen |
| `0`–`9` | Seek to 0%–90% of the video (`5` jumps to the halfway point) |

> [!NOTE]
> Playback speed is clamped between `0.25×` and `3×`; each `+`/`-` press nudges it by `0.25×` and shows the new speed as a toast.

> [!TIP]
> In fullscreen you can still capture notes — `F` (or the expand button on the player) opens an in-video note overlay. See [Taking notes → Fullscreen](taking_notes.md) and the [Fullscreen note overlay](#fullscreen-note-overlay) keys below.

## Note list

Active when a video has notes and you are **not** editing one. The selection moves through the notes currently shown in the detail pane (filtered notes if a note filter is applied).

| Keys | Action |
| --- | --- |
| `↑` | Select the previous note |
| `↓` | Select the next note |
| `Enter` | Edit the selected note |
| `Delete` | Delete the selected note |

The selected note scrolls into view automatically as you move through the list.

## Note editor

These are scoped to the note editor text area — they work *while* you are typing a note, where the global shortcuts are suppressed.

| Keys | Action |
| --- | --- |
| `Ctrl + Enter` | Save the note |
| `Ctrl + S` | Save the note |
| `Esc` | Cancel editing |

On macOS, `Cmd + Enter` and `Cmd + S` also save. The editor shows this hint inline: *Ctrl+Enter / Ctrl+S to save · Esc to cancel*.

### Fullscreen note overlay

When you capture a note while the video is fullscreen, a single-line overlay input appears over the video instead of the side editor.

| Keys | Action |
| --- | --- |
| `Enter` | Save the note and (if auto-pause is on) resume playback |
| `Esc` | Cancel and resume playback |

## Keyboard navigation

ytnt has an optional, app-wide keyboard layer modelled on Phoneme. It is **off by default** — turn on **Arrow-key navigation**, **Vim (hjkl) navigation**, or both in **Settings → Motion & navigation**. Arrow keys drive navigation when arrow-nav is on; `H`/`J`/`K`/`L` drive it when vim-nav is on; the two layers are independent and combine. The focused pane shows a faint accent rail, and a small HUD pins to its edge showing where the cursor sits. `Esc` steps out.

### Jump to a pane or view (`G` leader)

Press `G`, then a destination:

| Keys | Action |
| --- | --- |
| `G` then `G` | Go to the first item in the focused pane (vim-nav on) |
| `G` then `L` | Focus the video list |
| `G` then `B` | Focus the sidebar filters |
| `G` then `V` | Enter the **player** — the YouTube playback keys go live (`Esc` steps out) |
| `G` then `D` | Focus the detail pane's controls (title, tabs, tags, notes) |
| `G` then `N` / `T` | Switch the detail pane to Notes / Transcript |
| `G` then `S` | Open Settings |
| `G` then `Shift + D` | Open Diagnostics |
| `G` then `/` | Search all notes |

The `G` chords that open a modal (`G S`, `G /`, `G Shift+D`) work even with nav disabled; the pane-focus chords need a nav layer on.

### Move the cursor

Once a pane is focused, the cursor moves through its controls:

| Keys | Action |
| --- | --- |
| `H` / `L` (or `←` / `→`) | Move left / right — at a pane's edge, step to the next pane |
| `J` / `K` (or `↓` / `↑`) | Move down / up within the pane |
| `Enter` (or `I`) | Activate the cursored control |
| `Esc` | Drop the pane focus |

In the **sidebar** and **detail** panes the cursor is a 2-D grid: controls are bucketed into rows, and your column is kept (nearest-match) as you move up and down. In the **video list** the cursor is a single vertical column with a few extra keys:

| Keys | Action |
| --- | --- |
| `↑` / `↓` (or `J` / `K`) | Previous / next video |
| `Home` / `End` | First / last video |
| `Enter` | Open (or close) the cursored video |
| `Space` | Toggle the cursored video in the bulk selection |
| `Esc` | Clear the bulk selection |
| `Shift + click` a library card | Toggle that video in the bulk selection |

Once one or more videos are selected, a floating bulk-actions bar appears for tagging or deleting them in one go. See [Library and filters](library_and_filters.md) for the full bulk workflow.

## Inline inputs

Several small fields commit on `Enter` and dismiss on `Esc` — handy to know so you don't reach for the mouse:

| Field | Keys | Action |
| --- | --- | --- |
| **Add video / playlist URL** (top bar) | `Enter` | Add the video or import the playlist |
| **Video title** (click the title to edit) | `Enter` / `Esc` | Save / cancel the rename |
| **Add tag** (detail pane) | `Enter` | Apply the typed tag |
| **Edit tag** popover (click a tag chip) | `Enter` / `Esc` | Rename / cancel |
| **Bulk tag** (bulk-actions bar) | `Enter` | Apply the tag to all selected videos |

See [Tags](tags.md) for tagging and recoloring, and [YouTube account and playlists](youtube_account_and_playlists.md) for importing from a playlist URL.

## Modals and overlays

Every overlay (search, settings, find & replace, tag manager, cheat sheet) shares the same two keys:

| Keys | Action |
| --- | --- |
| `Esc` | Close the overlay (cancels the action) |
| `Tab` / `Shift + Tab` | Move focus to the next / previous control, wrapping within the overlay |

Focus is trapped inside the open overlay for accessibility, and returns to wherever you were when the overlay closes.

## In-app cheat sheet

Press `?` to open the built-in cheat sheet. It shows the most common keys — a curated subset of this page:

| Keys | Action |
| --- | --- |
| `Ctrl+N` | Add note at the current moment |
| `Space / K` | Play / pause |
| `J / L` | Back / forward 10s |
| `← / →` | Back / forward 5s (Shift = 30s) |
| `+ / −` | Playback speed up / down |
| `M / F` | Mute / fullscreen |
| `Ctrl+B` | Toggle sidebar |
| `Shift+click` | Select videos (bulk) |
| `G then L / B` | Focus the list / sidebar filters |
| `G then V` | Enter the player (playback keys live) |
| `G then D` | Focus the detail pane's controls |
| `G then N / T` | Switch detail pane to Notes / Transcript |
| `G then S` | Open Settings |
| `H J K L` | Move the cursor (a pane focused, nav on) |
| `↑ ↓ ← →` | Arrow nav (arrow-nav on) |
| `Home / End` | First / last item in the focused list |
| `Enter` | Open (activate) the cursored item |
| `Space` | Toggle the cursored video in bulk selection |
| `0–9` | Seek to 0–90% |
| `↑ / ↓` | Select previous / next note |
| `Enter / Delete` | Edit / delete selected note |
| `/` | Search all notes |
| `?` | Keyboard shortcuts (this) |
| `Esc` | Close dialog / cancel |

## See also

- [Taking notes](taking_notes.md) — capture, offset, auto-pause, and fullscreen notes
- [Library and filters](library_and_filters.md) — search, the sidebar, and bulk selection
- [Tags](tags.md) — tagging, recoloring, and the tag manager
- [YouTube account and playlists](youtube_account_and_playlists.md) — adding videos and importing playlists
- [Appearance and window](appearance_and_window.md) — themes and the strip-titlebar window mode
- [Settings reference](settings_reference.md) — every setting and where it lives
- [Getting started](getting_started.md) — first-run walkthrough
- [Troubleshooting](troubleshooting.md) — when a shortcut or the player misbehaves
