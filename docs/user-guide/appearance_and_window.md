# 🎨 Appearance & window

ytnt is a desktop note-taking app you keep open next to a video for hours at a stretch, so it should look the way *you* want and get out of your way when you're watching. This page covers the theme picker, the borderless **strip system title bar** mode, the fullscreen video panel with its in-fullscreen note capture, and why ytnt hides YouTube's own fullscreen button.

Both visual settings live under **Settings → Appearance** (open the gear icon, top right). They're stored in your browser-local settings (`localStorage` key `ytnt.settings`) and applied instantly — no save button.

## 🌈 Themes

ytnt ships with sixteen hand-tuned color palettes drawn from popular editor themes. Each one sets the app's full color contract (backgrounds, text tiers, accent, status colors), so tags, the timeline, toasts, and the keyboard cursor glow all stay coherent in whichever palette you pick.

To change theme:

1. Open **Settings** (the gear icon).
2. Under **Appearance**, open the **Theme** dropdown.
3. Pick a palette. The whole window recolors immediately.

The dropdown is split into two groups, **Dark** and **Light**:

| Group | Themes |
| --- | --- |
| **Dark** | Catppuccin Mocha *(default)*, Catppuccin Macchiato, Catppuccin Frappe, Tokyo Night, Dracula, Nord, Gruvbox, Everforest, Kanagawa, One Dark, Rose Pine |
| **Light** | Catppuccin Latte, Tokyo Night Day, Gruvbox Light, Rose Pine Dawn, Solarized Light |

The default is **Catppuccin Mocha**. Your choice is saved and re-applied before the first paint on the next launch, so you never see a flash of the default theme.

> [!NOTE]
> Themes are applied by setting `data-theme="<slug>"` on the page root and swapping CSS variables — there is no reload and nothing is regenerated. Switching is instant and completely reversible; flip back any time with no data impact.

> [!TIP]
> The accent color you see in each theme is what colors the timeline, the progress bar, note markers, and the focus ring. Several palettes (Dracula, Rose Pine) only ship two dark tones or no green; ytnt fills those gaps with palette-native stand-ins so contrast stays readable.

## 🪟 Strip system title bar

**Strip system title bar** (**Settings → Appearance → Strip system title bar**, off by default) turns ytnt into a borderless, clean window with **no OS title bar and no window buttons**. It's built for tiling and keyboard-driven window managers, where the OS chrome is redundant and the window is moved, resized, and closed entirely from your WM.

When this is on:

- The window loses its native decorations (the title bar and the minimize/maximize/close buttons).
- The app's own top bar becomes a drag region, so you can still reposition the window by dragging it if your environment allows.
- Use your **OS / window-manager shortcuts** to move, resize, and close the window — ytnt no longer draws those controls.

To toggle it, tick or untick **Strip system title bar** in Settings. The change takes effect live.

> [!WARNING]
> On Windows, turning this setting **back off** may not fully restore the native title bar until you **restart the app**. If the decorations don't come back right away, close ytnt and reopen it.

> [!NOTE]
> This is a window-decoration preference only — it changes nothing about your notes, library, or playback. It's safe to experiment with and is saved alongside the rest of your settings.

## ⛶ Fullscreen video panel

ytnt has its own fullscreen for the video, separate from collapsing the panes.

| Action | What it does | How |
| --- | --- | --- |
| **Fullscreen** | Fills the entire screen with the video, with the in-fullscreen note overlay available | Press `F`, or hover the player and click the expand button in its bottom-right corner |
| **Fullscreen the video panel** | Collapses both side columns (filters sidebar + video list) so the video and notes get the whole window — still inside the app, not OS fullscreen | The expand button in the now-playing header, next to **Open on YouTube ↗** |

The true fullscreen (`F`) takes over the screen the way a normal video player would, but it fullscreens ytnt's own player wrapper — which is what lets the note overlay render *on top* of the video.

> [!TIP]
> The small expand button only fades in when you hover the player, so it doesn't sit over the picture while you watch. `F` works any time a video is loaded, whether the player or the app has focus.

To leave fullscreen, press `F` again or `Esc`.

### Capturing a note while fullscreen

The whole point of ytnt's fullscreen is that you don't have to leave it to jot something down. In normal layout, **Add note** (`Alt+N`) opens the editor in the notes pane — but that pane is hidden in fullscreen. So when you're fullscreen, capturing a note instead pops a slim **note overlay** at the bottom of the video:

1. While fullscreen, press `Alt+N` (or your usual capture key).
2. A timestamped input bar slides up over the video, pre-stamped with the current moment (minus your [capture offset](taking_notes.md)).
3. Type your note.
4. Press `Enter` (or click **Add**) to save it, or `Esc` to cancel.

If **auto-pause** is on (it is by default), the video pauses while the overlay is open and resumes when you save or cancel — exactly like the normal note editor. The note lands at the captured timestamp and shows up in your notes list the moment you exit fullscreen.

> [!NOTE]
> The overlay shows the timestamp it will use on the left, so you can confirm the moment before you commit. The capture offset still applies, so the stamp lands a few seconds before your keypress — see [Taking notes](taking_notes.md) for how the offset works.

## 🚫 Hiding YouTube's own fullscreen button

You'll notice the embedded YouTube player has **no fullscreen button of its own** — that's deliberate. ytnt asks the YouTube player to hide it so that **ytnt's fullscreen is the only one**.

The reason: the native YouTube fullscreen would put the bare iframe on top of everything, leaving no room for ytnt's note overlay. By routing fullscreen through ytnt's own button and the `F` key, the player fullscreens *inside* the app, and the note-capture overlay can render over the video. You get fullscreen video **and** the ability to add timestamped notes without leaving it.

> [!TIP]
> Always use `F` or ytnt's expand button for fullscreen. There's nothing to enable or configure — this is on by default and is what makes in-fullscreen note capture possible.

## See also

- [Settings reference](settings_reference.md) — every setting in one place, with defaults.
- [Taking notes](taking_notes.md) — the capture offset and auto-pause that the fullscreen overlay uses.
- [Keyboard shortcuts](keyboard_shortcuts.md) — `F` for fullscreen, `Alt+N` to capture, and the rest of the transport keys (press `?` in the app for the cheat sheet).
- [Tags](tags.md) — tag colors that follow the active theme's accent.
- [Troubleshooting](troubleshooting.md) — if the title bar doesn't come back after toggling strip mode on Windows.
