# 📚 Library & filters

Your library is every video you've loaded into ytnt — the middle pane in the three-column layout (filters sidebar | video list | detail). Once you've got more than a handful of videos, the sidebar filters and global search are how you find the one you want fast, and bulk actions let you tag or clear out a whole batch at once.

The window is split into three columns:

| Column | What it holds |
| --- | --- |
| **Sidebar** (left) | Filters: Library, Tags, and your YouTube Playlists. |
| **Library list** (middle) | The cards for the videos that match the current filter. |
| **Detail** (right) | The selected video's player, notes, and transcript. |

You can collapse either side column to give the player more room — see [Appearance & window](appearance_and_window.md). Press `?` anywhere for the in-app keyboard cheat sheet.

## 🎬 The video list

Each video in your library is a **card** in the middle pane. Click a card to load it in the detail pane; click the same card again to deselect it and stop playback.

A card shows, top to bottom:

| Element | What it shows |
| --- | --- |
| **Thumbnail** | YouTube's medium thumbnail. A broken/unavailable image is hidden rather than shown as a placeholder. |
| **Duration badge** | The runtime (e.g. `12:30`) in the thumbnail's bottom-right corner — only once metadata is known. |
| **Title** | The video title (up to two lines). Falls back to the video ID until the title is fetched. |
| **Metadata line** | Channel · view count · publish date, e.g. **Veritasium · 4.2M views · 3 years ago**. Each part appears only when known. |
| **Note count** | `5 notes` (or `1 note`), plus a `transcript` pill if the video is linked to a [Phoneme](phoneme_integration.md) transcript. |
| **Tag chips** | The video's [tags](tags.md), each in its own color. |

> [!NOTE]
> The channel, view count, publish date, and duration come from YouTube and only appear after the metadata is pulled. That happens automatically when your [YouTube account](youtube_account_and_playlists.md) is connected. The title is filled in on first playback even without a connected account. Until then a card shows just the thumbnail, title (or ID), and note count.

View counts are shown compactly — `1.5K views`, `4.2M views`, `2B views` — and dates are coarse and relative (`today`, `yesterday`, `12 days ago`, `3 months ago`, `3 years ago`).

### Card actions

Hover a card (or select it) to reveal two buttons stacked on its right edge:

| Button | Action |
| --- | --- |
| **Pin** | Pin the video to the top of the list (toggle). |
| **Remove** (×) | Remove the video from your library. |

Removing prompts you about YouTube playlists. If the video belongs to one or more of your YouTube playlists, ytnt asks whether to **also** remove it from those playlists, or just from the local library. Removing it from the library always deletes its notes here.

> [!WARNING]
> Removing a video deletes it and **all its notes** from your local library. There's no undo. If you only meant to take it off a YouTube playlist while keeping your notes, use the per-item **Remove from playlist** button in [playlist browse](youtube_account_and_playlists.md#-browsing-playlists) instead.

### Pin to top

Click the **Pin** button on a card to float it to the top of the list. Pinned videos always sort above unpinned ones, regardless of the newest/oldest sort order, so your active or favorite videos stay one click away. Click **Pin** again (now an **Unpin** button) to release it.

### Sort order

The **Library** section header in the sidebar has a sort toggle on the right showing **Newest** or **Oldest**. Click it to flip the list between newest-first (the default) and oldest-first. Pinned videos always stay on top either way.

## ✅ Multi-select & bulk actions

Working through a batch — tagging a week's worth of lecture videos, or clearing out a finished playlist? Select several cards at once and act on all of them.

1. **Shift-click** a card to add it to the selection (instead of opening it). Shift-click again to deselect that card.
2. A floating **bulk-actions bar** appears showing `N selected`.
3. Pick an action, or **Deselect** to clear the selection.

Selected cards are highlighted, and the bar floats centered near the bottom of the window. Grab the **⠿** grip on its left edge to drag it anywhere if it covers something you need.

The bar offers:

| Action | What it does |
| --- | --- |
| **🏷 Tag** | Opens a menu of your existing tags — click one to apply it to every selected video. The `+ new tag…` field at the bottom creates and applies a brand-new tag. |
| **🗑 Delete** | Removes every selected video (and its notes) from the library. |
| **✕ Deselect** | Clears the selection and hides the bar. |

> [!CAUTION]
> Bulk **Delete** removes every selected video and all of their notes with no confirmation and no undo. Double-check the `N selected` count before clicking.

> [!TIP]
> Bulk **Tag** respects [tag sync](tags.md) — for any selected video that's linked to a Phoneme recording, the tag is pushed to Phoneme too.

## 🗂 The sidebar filters

The left sidebar groups your library into collapsible sections. Click a section header (with its chevron) to fold or unfold it. Clicking a filter narrows the middle list; the active filter is highlighted, and each entry shows a **count** of how many videos it matches.

### Library

| Filter | What it shows |
| --- | --- |
| **All videos** | Every video in your library. |
| **With transcript** | Only videos linked to a [Phoneme](phoneme_integration.md) transcript. |

### Tags

The **Tags** section appears once you have at least one tag. Its header has a gear button that opens the [Tag Manager](tags.md#-the-tag-manager).

| Filter | What it shows |
| --- | --- |
| **Untagged** | Videos with no tags (grey dot). |
| **Tagged** | Videos with at least one tag (rainbow dot). |
| **<tag name>** | One entry per tag, each with its color dot — shows only videos carrying that tag. |

Click a tag again to turn it off and go back to all videos. Tag filters and the Library/Tags filters are mutually exclusive — picking one resets the others.

See [Tags](tags.md) for adding, renaming, recoloring, and syncing tags.

### Playlists

If your [YouTube account](youtube_account_and_playlists.md) is connected, a **Playlists** section lists your YouTube playlists with their item counts. Clicking one switches the middle pane into **playlist browse** mode, where you can toggle each video in or out of your library. The gear on the section header opens a show/hide menu so you can hide playlists you never use.

> [!NOTE]
> Playlist browse is a view onto YouTube, not a library filter — it shows the playlist's videos (whether or not they're in your library) rather than filtering the videos you already have. Full details live in [YouTube account & playlists](youtube_account_and_playlists.md).

### Nothing matches?

If a filter leaves the list empty, you'll see **"No videos match this filter."** with a **Clear filters** button that resets back to **All videos**. An entirely empty library shows **"No videos yet — load one to start."** instead — paste a link in the bar at the top.

## 🔎 Search

Two different searches cover two different needs:

| Search | Where | What it searches |
| --- | --- | --- |
| **Filter notes** | The toolbar above the notes list, in the detail pane | Live substring filter of the **current** video's notes only. |
| **Search all notes** | The 🔍 button in the top bar, or press `/` | Full-text search across **every** note in your library. |

### Filter the current video's notes

When a video is open, the **Filter notes…** box in the notes toolbar trims the list to notes whose text contains what you type. It's an instant, case-insensitive substring match — no `Enter` needed. Clear the box to see all notes again.

### Search all notes

Press `/` (or click the 🔍 search icon in the top bar) to open the global search dialog, then start typing. Results are full-text matches across all your notes, each showing the note's timestamp, its video's title, and the matching text. Click a result to open that video and jump straight to the note's moment.

If [Phoneme](phoneme_integration.md) is running, search also queries Phoneme and lists any matching recordings under a **From Phoneme** heading. Clicking one of those opens the linked video here (or tells you if that recording isn't linked to a video in ytnt).

Close the dialog with `Esc` or by clicking outside it.

## ⌨️ Handy shortcuts

| Keys | Action |
| --- | --- |
| `/` | Open **Search all notes** |
| `Shift` + click | Select / deselect a video card (bulk) |
| `Ctrl + B` | Toggle the filters sidebar |
| `?` | Show the keyboard cheat sheet |
| `Esc` | Close the search dialog |

The full list is in [Keyboard shortcuts](keyboard_shortcuts.md).

## See also

- [Taking notes](taking_notes.md) — capturing, editing, and exporting notes for the selected video.
- [Tags](tags.md) — colored tags, the Tag Manager, and tag sync.
- [YouTube account & playlists](youtube_account_and_playlists.md) — connecting Google, browsing playlists, and metadata.
- [Phoneme integration](phoneme_integration.md) — transcripts, the **With transcript** filter, and cross-app search.
- [Appearance & window](appearance_and_window.md) — collapsing panes, themes, and the borderless window.
- [Keyboard shortcuts](keyboard_shortcuts.md) — every key the app listens for.
- [Troubleshooting](troubleshooting.md) — when thumbnails, metadata, or playlists don't show up.
