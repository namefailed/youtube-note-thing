# 🏷️ Tags

Tags are how you slice your library by topic instead of by upload date. Drop a tag on a video and it joins a named bucket you can jump to from the sidebar in one click — and every tag carries a color, so a glance at the dots tells you what kind of video you're looking at. Tags live entirely on your machine; if you also run [Phoneme](phoneme_integration.md), the videos you've sent there keep their tags in sync both ways.

There's no separate "tags table" under the hood — a tag is just a label attached to a video. Add it to a video and it exists; remove it from the last video and it's gone. That keeps things simple: you never manage a catalog, you just tag videos.

## 🏷️ Tagging a video

Every video's detail panel (the right pane) has a tag strip just under the player, showing the current tags as colored chips followed by a `+ tag` box.

1. Open a video so its detail panel is showing.
2. Click the **+ tag** box at the end of the tag strip.
3. Type a name and press `Enter`.

The chip appears immediately. Adding a tag that's already on the video does nothing — duplicates are ignored.

To remove a tag, hover its chip and click the **×** on the right side of the chip. The video drops out of that tag's bucket right away. If that was the last video carrying the tag, the tag disappears from the sidebar (there's nothing left to point to).

> [!TIP]
> To tag several videos at once, multi-select them in the library list (shift-click each video to toggle its selection) and use **Tag…** in the bulk actions bar. See [Library & filters](library_and_filters.md) for multi-select and bulk actions.

### Filtering by tag

Tags double as filters. The **Tags** section in the left sidebar lists every tag in your library, each with its colored dot and a count of how many videos carry it. Click a tag to show only those videos; click it again to clear the filter. Two built-in entries sit at the top of the section:

| Filter | What it shows |
|---|---|
| **Untagged** | Videos with no tags at all (grey hollow dot). |
| **Tagged** | Videos carrying at least one tag (rainbow dot). |

Selecting a tag filter clears any active playlist filter, and vice versa — you filter by one thing at a time. The full filter set is covered in [Library & filters](library_and_filters.md).

## 🎨 Tag colors

A tag's color follows it everywhere: the chips in the detail panel, the dots in the sidebar, and the swatches in the [Tag Manager](#-the-tag-manager). A tag with no color set renders in the current theme's accent color (mauve `#cba6f7` on the default Catppuccin Mocha theme); the color picker itself starts at mauve (`#cba6f7`) until you pick something else.

### The chip popover (rename + recolor)

Click a tag chip's body (the name, not the **×**) in the detail panel to open its editor popover. From here you can rename and recolor the tag in one place:

| Control | What it does |
|---|---|
| **Tag name** field | Rename the tag (see [Renaming](#renaming-a-tag) below). |
| **Color palette** | 14 preset swatches (the Catppuccin Mocha accent row). Click one to apply it instantly; the current color is outlined. |
| **Any color…** swatch | The rightmost swatch opens your OS color picker for a custom hex. |
| **Save** | Commit the typed name. |
| **Cancel** | Close the popover without renaming (any color you clicked is already applied). |

Color changes take effect the moment you click a swatch — there's no separate "apply color" step. Press `Escape` to close the popover.

> [!NOTE]
> Colors you set are saved locally (in `ytnt.tagColors`) and always win over whatever color Phoneme reports for the same tag. So a custom color you pick here sticks even if Phoneme has a different one on record.

### Sidebar tag dots

Every tag in the sidebar's **Tags** section shows a small colored dot next to its name, matching the tag's color. The dot is your at-a-glance legend — scan the sidebar and you can tell topics apart without reading names. The two built-in filters have their own marks: **Untagged** uses a hollow grey dot, **Tagged** uses a rainbow dot.

## ⚙️ The Tag Manager

The Tag Manager is a single screen for tidying up every tag at once, instead of editing them one video at a time.

Open it from the **gear** icon on the right of the **Tags** section header in the sidebar. (The gear only appears once you have at least one tag.)

Each row shows:

| Element | What it does |
|---|---|
| **Color swatch** | Click to recolor the tag with your OS color picker. |
| **Name** field | Edit and press `Enter` (or click away) to rename the tag everywhere. |
| **Usage badge** | Shows `N uses` if the tag is attached to videos, or `unused` if it's attached to none. |

A header note reminds you that changes here are local, and that colors mirror from Phoneme. There is no delete or merge button — a tag vanishes on its own once it's off every video, and deleting/merging the catalog itself happens in Phoneme.

> [!TIP]
> When the **Sync tags with Phoneme** setting is on, the Tag Manager also shows a **Sync all** button that pulls and pushes tags for every video you've sent to Phoneme in one pass. It's disabled (with a tooltip) when Phoneme isn't running. See [Syncing with Phoneme](#-syncing-with-phoneme) below.

### Renaming a tag

Renaming — from either the chip popover or the Tag Manager — rewrites the tag on every video that carries it, and migrates your local color override to the new name. If a tag filter for the old name was active, it follows the rename. The new name must be non-empty and different from the old one, or nothing happens.

> [!NOTE]
> Renaming merges by name: if you rename `talks` to an existing tag `talk`, videos that had both end up with a single `talk` chip (no duplicates).

## 🔗 How tags relate to Phoneme

[Phoneme](phoneme_integration.md) is the sibling local transcription app, and it owns the tag catalog — it's where tags are truly created, colored, deleted, and merged. ytnt mirrors that catalog rather than maintaining its own:

- **Colors flow in from Phoneme.** When Phoneme is running, ytnt pulls each tag's color so a shared tag looks identical in both apps. Your own local color picks (above) override what Phoneme reports.
- **Names match by spelling, case-insensitively.** A tag is the "same" tag in both apps when the names match ignoring case, so `Music` here lines up with `music` in Phoneme.
- **ytnt never creates or deletes tags in Phoneme's catalog on its own.** It attaches and detaches tags on the recordings it has links to (see below), and a rename is forwarded so the catalog entry isn't orphaned — but there's no "delete tag" route from ytnt.

> [!IMPORTANT]
> All of this is optional. With Phoneme absent, tags are **purely local** — you add, color, rename, and filter exactly the same way; nothing syncs anywhere and nothing breaks. Phoneme integration only adds the two-way membership sync described next.

## 🔁 Syncing with Phoneme

For any video you've **sent to Phoneme to transcribe** (the **Transcribe with Phoneme** button on the Transcript tab — see [Phoneme integration](phoneme_integration.md)), ytnt keeps tag membership in sync in both directions:

- Tag a video here, and the tag is attached to its Phoneme recording.
- Tag the recording in Phoneme, and the tag shows up on the video here.

The sync is a 3-way merge against a snapshot of the last successful sync, so adds and removals on each side combine cleanly without clobbering each other. The first sync for a video is a union (no history yet means nothing is ever deleted).

This runs automatically when:

- you open a linked video,
- you add, remove, rename, or bulk-apply a tag on a linked video, and
- Phoneme comes back online (any edits you made while it was closed are pushed then).

It is controlled by **Settings → Phoneme → Sync tags with Phoneme** (on by default). The setting's help text sums it up: two-way for videos you've sent to Phoneme, with edits made while Phoneme is closed syncing the next time it's running.

> [!NOTE]
> Only videos **linked to a Phoneme recording** sync. Videos that were never sent to Phoneme stay local-only, even with the setting on. Edits made while Phoneme is closed aren't lost — they're queued and pushed automatically the next time Phoneme is running.

> [!TIP]
> To force a full reconcile across every linked video right now, open the [Tag Manager](#-the-tag-manager) and click **Sync all**. A toast reports how many linked videos were synced.

## See also

- [Library & filters](library_and_filters.md) — filtering by tag, multi-select, and the bulk **Tag…** action.
- [Phoneme integration](phoneme_integration.md) — sending videos to transcribe and the tag-catalog relationship.
- [Settings reference](settings_reference.md) — **Sync tags with Phoneme** and the Phoneme CLI path.
- [Taking notes](taking_notes.md) — the detail panel where the tag strip lives.
