# Roadmap

A living, non-binding view of where youtube-note-thing is and where it might go.
Nothing here is a commitment or a dated promise.

## Working today

- **Notes** — timestamped notes with a capture offset and auto-pause, resume
  position, reorder vs. time-sort, full-text search (SQLite FTS5), find & replace,
  per-video Markdown export, JSON import/export.
- **Library** — three-pane layout, rich cards (channel, views, publish date,
  duration), pin-to-top, shift-click multi-select with a bulk-actions bar, and
  filters (all / has-transcript / tagged / untagged / by-tag / by-playlist).
- **Tags** — colored tags with a chip rename/recolor popover, sidebar dots, and a
  Tag Manager; colors, names, and membership stay in sync with Phoneme (the tag
  authority) for videos you've transcribed.
- **YouTube account** — connect via Google, browse playlists, toggle videos in and
  out of your library, remove a video from a playlist, and backfill video metadata.
- **Phoneme integration** — send a video to transcribe, view the transcript,
  compare model versions, read the summary and chapters, with live progress.
- **Appearance** — multiple themes, a strip-system-titlebar mode for tiling /
  keyboard window managers, and a fullscreen video panel with an in-fullscreen
  note overlay.

## Ideas under consideration

These are possibilities, not plans:

- Packaged, signed installers and a proper release cadence.
- First-class macOS / Linux testing (the app is built cross-platform but is
  primarily exercised on Windows).
- Optional sync of tag colors / notes across machines.
- Deeper Phoneme features (e.g. "Ask your archive") once they're reachable over a
  stable interface.
- Screenshots and short clips throughout the documentation.

Have an idea? Open a feature request — see the issue templates.
