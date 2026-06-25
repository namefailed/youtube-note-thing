# 📝 Taking notes

Timestamped notes are the heart of ytnt. While a YouTube video plays, you capture a thought and it's pinned to the exact moment it belongs to — one keypress, no scrubbing back later to find "the bit where they said that". Every note is a clickable jump-back link, every note is full-text searchable across your whole library, and any video's notes export to clean Markdown for your vault.

This page covers capturing notes, the capture offset, auto-pause, editing and reordering, the in-fullscreen overlay, searching across notes, find & replace, and Markdown export. For loading and filtering videos see [Library and filters](library_and_filters.md); for the full key map see [Keyboard shortcuts](keyboard_shortcuts.md).

> [!TIP]
> Press `?` anywhere (when you're not typing in a field) to open the in-app keyboard cheat sheet.

## ✍️ Capturing a note

A note is a timestamp plus some text. The timestamp comes from wherever the player is when you capture; the text is yours.

1. Load a video and start it playing (paste a link in the top bar and click **Load**, or pick one from the list).
2. When you reach a moment worth marking, press `Alt + N` — or click **Add note** on the **Notes** tab.
3. Type your note in the editor that appears. **Markdown is supported.**
4. Press `Ctrl + Enter` (or `Ctrl + S`) to save, or `Esc` to cancel.

The new note slots into the list at its timestamp, and a small marker appears on the timeline bar under the video at the matching position. Click any note's timestamp to jump the player straight there.

> [!NOTE]
> `Alt + N` and the player transport keys work even when the YouTube iframe has stolen focus — ytnt drives the player through its API and quietly hands keyboard focus back to itself, so your shortcuts keep firing after you click the video.

### The editor

| Keys | Action |
| --- | --- |
| `Ctrl + Enter` | Save the note |
| `Ctrl + S` | Save the note (same as above) |
| `Esc` | Cancel — discards a brand-new note's text |

The editor placeholder reminds you: *Write a note… Markdown supported.* Notes render as Markdown in the list (links open in your browser).

## ⏱️ Capture offset — why your note lands a few seconds early

By the time you *react* to something and hit `Alt + N`, the moment you wanted is already a few seconds in the past. The **capture offset** fixes that: ytnt subtracts a fixed number of seconds from the player's current time when it stamps the note, so the timestamp lands just before the keypress — right on the moment, not after it.

- Set it at **Settings → Capture → Capture offset (seconds)**.
- Range `0`–`30`; default `3`.
- The offset never produces a negative timestamp — near the start of a video it just clamps to `0:00`.

> [!TIP]
> If you find your jump-backs consistently land *after* the thing you meant to mark, bump the offset up by a couple of seconds.

## ⏸️ Auto-pause when adding a note

So you can finish a thought without the video running on without you, ytnt can pause playback the instant you start a note and resume it when you save or cancel.

- Toggle it at **Settings → Capture → Auto-pause when adding a note**.
- When on: capturing a note pauses the video; saving a **new** note (or cancelling one) resumes it. In the [fullscreen overlay](#-the-in-fullscreen-note-overlay) it pauses on capture and plays again on save or cancel.
- Editing an *existing* note doesn't auto-resume — only newly captured notes do.

## ✏️ Editing notes

Each note row has actions on the right; you can also work the list from the keyboard.

| Action | How |
| --- | --- |
| **Edit** | Click the **Edit** (pencil) icon, or select a note and press `Enter`. |
| **Delete** | Click the **Delete** (trash) icon, or select a note and press `Delete`. |
| **Jump to the moment** | Click the note's **timestamp** button. |
| **Copy timestamp link** | Click the **Copy timestamp link** icon — copies a `https://youtu.be/<id>?t=<secs>` link to the clipboard. |

To move the selection with the keyboard, use `↑` / `↓` (the selected note scrolls into view). `Enter` edits it, `Delete` removes it. These work when the player is loaded and you're not already editing.

> [!NOTE]
> A note's timestamp is set at capture time and isn't editable in the UI — editing changes only the text. To re-time a note, delete it and capture a new one (or copy the text across).

## ↕️ Reordering vs. sorting by time

By default notes are listed in **timestamp order**. You have two ways to change that.

- **Manual reorder** — each note has **Move up** / **Move down** arrows. Use them to hand-order notes (handy when several share a moment, or you want a logical rather than chronological flow). The first manual move switches the video into manual-order mode.
- **Back to time order** — once a video is in manual order, a **By time** button appears in the **Notes** toolbar. Click it to drop the manual order and sort by timestamp again.

> [!NOTE]
> The reorder arrows only show when the note **filter box is empty** — reordering a filtered subset would be ambiguous, so clear the filter first.

### Filtering the note list

Next to **Add note** is a **Filter notes…** box. It does a live, case-insensitive substring match over the current video's notes — a quick way to narrow a long list. (This is per-video; for searching *every* video see [full-text search](#-full-text-search-across-all-notes) below.)

## 🖥️ The in-fullscreen note overlay

You don't have to leave fullscreen to jot something down.

1. With a video open, click the expand button on the player (its tooltip reads *Fullscreen (F) — add notes without leaving*), or press `F`.
2. While fullscreen, press `Alt + N`. A slim note bar appears over the video showing the captured timestamp and an input.
3. Type your note and press `Enter` to save, or `Esc` to cancel. (You can also click **Add** to save.)

The overlay obeys the same **capture offset** and **auto-pause** settings as the normal editor — auto-pause stops the video when the bar opens and resumes it once you save or cancel.

> [!NOTE]
> This in-player overlay is specifically for ytnt's own fullscreen of the video panel. Press `F` again (or `Esc`) to leave fullscreen.

> [!TIP]
> `F` is fullscreen for the video itself. There's also a separate **Fullscreen the video panel** button in the detail header (and the focus toggle) that just collapses the two side columns to give the video more room without going true-fullscreen — see [Appearance and window](appearance_and_window.md).

## 🔎 Full-text search across all notes

Filtering finds notes in *one* video; search finds notes across your *whole* library.

1. Press `/` (or click the **Search all notes** magnifier in the top bar).
2. Type your query. Results appear live, each showing the note's timestamp, the video title, and the matching text.
3. Click a result to open that video and seek to the note's moment.

Search runs against an FTS5 full-text index over every note, so it stays fast as your library grows. Press `Esc` to close the dialog.

> [!NOTE]
> If [Phoneme](phoneme_integration.md) is connected, the search dialog also shows a **From Phoneme** group with matching transcript hits. Clicking one opens the linked video here (or tells you if that recording isn't linked to a video in ytnt). Phoneme is entirely optional.

## 🔁 Find & replace in notes

Need to fix a recurring typo or rename something across one video's notes?

1. On the **Notes** tab, click the **Find & replace** icon (enabled once the video has notes).
2. Enter the text to **Find** and the **Replace with** text (leave the replacement blank to delete the matched text).
3. Click **Replace all**.

ytnt does a **literal, case-sensitive** replace across every note of the **current video** and reports how many notes changed. There's no regex — it's a plain text swap.

> [!CAUTION]
> Replace all rewrites the matching notes immediately and there's no in-app undo. If you're unsure, [export a backup](settings_reference.md) first.

## 📤 Markdown export of a video's notes

Every video's notes export to portable Markdown — a heading, the video link, then a bulleted list of `[timestamp](link) note` lines, sorted by time. It drops straight into Obsidian or any other Markdown PKM.

On the **Notes** tab, open the **Export** menu (shown once the video has notes):

| Option | What it does |
| --- | --- |
| **Copy as Markdown** | Copies the formatted Markdown to your clipboard. |
| **Download .md** | Saves a `.md` file named after the video title. |
| **Save to vault** | Writes the `.md` straight into your configured vault folder. Disabled until you set one. |

The exported document looks like this:

```markdown
# Video title

https://youtu.be/VIDEO_ID

## Notes

- [1:23](https://youtu.be/VIDEO_ID?t=83) First note
- [4:56](https://youtu.be/VIDEO_ID?t=296) Second note
```

> [!TIP]
> Set your vault folder at **Settings → Storage & backup → Vault folder** (a **Browse…** picker is provided) to unlock **Save to vault**. The same section also has whole-library JSON **Export** / **Import** for backups.

> [!NOTE]
> Exports cover the **currently open** video's notes. For a full-library backup, use JSON export instead — see [Settings reference](settings_reference.md).

## ⌨️ Notes & playback shortcuts

These fire when a video is loaded and you're not typing in a field.

| Keys | Action |
| --- | --- |
| `Alt + N` | Add a note at the current moment |
| `↑` / `↓` | Select previous / next note |
| `Enter` | Edit the selected note |
| `Delete` | Delete the selected note |
| `/` | Search all notes |
| `Space` / `K` | Play / pause |
| `J` / `L` | Back / forward 10s |
| `←` / `→` | Back / forward 5s (`Shift` = 30s) |
| `+` / `−` | Playback speed up / down |
| `M` / `F` | Mute / fullscreen |
| `0`–`9` | Seek to 0–90% of the video |
| `?` | Open the keyboard cheat sheet |
| `Esc` | Close a dialog / cancel an edit |

See [Keyboard shortcuts](keyboard_shortcuts.md) for the complete, grouped reference.

## See also

- [Getting started](getting_started.md) — install, first video, the three-pane layout.
- [Library and filters](library_and_filters.md) — loading videos, filters, pins, and bulk actions.
- [Tags](tags.md) — colored tags and the Tag Manager.
- [Phoneme integration](phoneme_integration.md) — transcripts, summaries, and note search across Phoneme.
- [Settings reference](settings_reference.md) — every setting, including capture offset, auto-pause, and the vault folder.
- [Keyboard shortcuts](keyboard_shortcuts.md) — the full key map.
- [Troubleshooting](troubleshooting.md) — if shortcuts stop firing or export doesn't write.
