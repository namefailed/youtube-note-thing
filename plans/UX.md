# UX

The product *is* the capture experience. Everything else is plumbing. Get the "watch → hit a key →
keep watching" loop frictionless and keyboard-driven; resist feature-mode sprawl.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│  youtube-note-thing                              — □ x     │
├────────────┬─────────────────────────────────────────────┤
│ 🔍 Search  │  ┌──────────────────────────────────────┐    │
│            │  │           YouTube IFrame player       │    │
│ 📚 Library │  └──────────────────────────────────────┘    │
│  ┌──────┐  │  ████████░░░░░░░ 0:33 / 12:34                 │
│  │thumb │  │   ●        ●          ○      ← note markers   │
│  │title │  │  ┌──────────────────────────────────────┐    │
│  │3 ▢   │  │  │ 📝 Notes — 3            [+ Add Note]  │    │
│  └──────┘  │  │  ┌────────────────────────────────┐  │    │
│            │  │  │ 00:33 │ first observation       │  │    │
│            │  │  │ 01:55 │ key insight             │  │    │
│            │  │  └────────────────────────────────┘  │    │
│            │  │  [transcript tab — only if an        │    │
│            │  │   integration provides one]          │    │
│            │  └──────────────────────────────────────┘    │
└────────────┴─────────────────────────────────────────────┘
```

### Responsive

- **Wide (>1200px):** player + notes side by side.
- **Medium:** player on top, notes below.
- **Narrow (<800px):** tabbed (Video / Notes).

### Empty state

Paste-a-URL box, plus recent videos if any. `Ctrl+O` opens from library.

## The capture loop (the whole point)

```
1. Watching a video.
2. Press the capture key (default Alt+N).
3. Video auto-pauses (if enabled). Timestamp is locked to the moment the key was pressed —
   read once from the time ref, so it's exact regardless of editor lag.
4. An inline editor opens at the top of the note list, prefilled "00:33 | <cursor>".
5. Type (Markdown supported). Ctrl+Enter saves; Esc cancels.
6. Video auto-resumes after a short, configurable delay.
```

Latency target: **< 100 ms** from keypress to editor ready. This is why the time lives in a ref, not
the store (see ARCHITECTURE).

## Interactions

**Click a timestamp** → `player.seekTo(t)`, video plays from there, the note card flashes "you are here."

**Marker timeline** (custom bar under the player): note dots as positioned divs; click the bar to seek,
click a dot to jump to that note, hover for a preview. The native YouTube bar stays visible but the
custom bar takes marker input.

**Note card** actions on hover: copy text · copy timestamp link (`youtu.be/ID?t=33`) · edit · delete.
Delete shows a 5-second "Undo" toast (no modal for the common case).

## Keyboard shortcuts (all rebindable)

| Key | Action |
|-----|--------|
| `Alt+N` | Add note at current time |
| `Space` | Play/pause (only when focus isn't in a text field) |
| `←` / `→` | Seek ∓5s · `Shift` for ∓30s |
| `↑` / `↓` | Move between notes |
| `Enter` / `Delete` | Edit / delete selected note |
| `Ctrl+Enter` / `Esc` | Save / cancel editor |
| `Ctrl+Shift+F` | Global search |
| `+` / `-` | Playback speed ∓0.25× |
| `Ctrl+,` | Settings |

Notes: `Alt+N` is free on Windows/macOS/Linux. `Space` only fires when no input/contenteditable is
focused. macOS users can remap `Ctrl+,` if it clashes with system prefs.

## Accessibility (a release requirement, not a nice-to-have)

- Full keyboard reachability; visible focus rings; focus trapped in modals, restored on close.
- After adding a note, focus moves to the editor; after delete, to the next card.
- ARIA: note list `role="list"`, cards `role="listitem"`; markers labelled "Jump to note at 0:33";
  custom bar `role="slider"` with min/max/now; export status in an `aria-live="polite"` region.
- Respect `prefers-reduced-motion` (slide-ins become instant); respect `prefers-color-scheme`.
- WCAG 2.1 AA contrast. Markers distinguishable by position+label, not color alone.

## Theming

System-aware dark/light. One accent color, themeable. Keep it boring and legible; this is a tool you
stare at while concentrating, not a landing page.

## Small wins worth copying (from competitors)

Cheap, high-value, borrowed from the field (see [COMPETITORS](COMPETITORS.md)):

- **Timestamp offset** — capture a few seconds *before* the keypress (you always react after the
  moment). A setting, default ~3s. (Obsidian Media Notes.)
- **Resume** — reopen a video at `last_pos_secs`. (Obsidian Media Notes.)
- **Customizable timestamp format** — `mm:ss` vs `hh:mm:ss`, link style. (Obsidian Timestamp Notes.)
- **JSON export / import** — one-click backup of the whole library to a portable JSON file, and restore.
  Data you own, not trapped in the app. (YiNote's lesson: its notes died with the extension; ours don't.)

## Deferred (don't build for v1)

Zen mode, audio-only mode, focus mode, A–B loop, note templates, in-video screenshots
(cross-origin — see ARCHITECTURE constraints). Each is a real idea and a real maintenance cost; revisit
only when the core loop is loved and one of these is actually missed. See [ROADMAP](ROADMAP.md).
