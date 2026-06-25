# ⚙️ Settings reference

Settings is where you tune how ytnt looks, when it captures a note, where backups and Markdown land, and which optional integrations (Phoneme, your YouTube account) are wired up. Everything here lives on **this device only** — preferences are kept in your browser's `localStorage` under the key `ytnt.settings`, alongside a couple of companion keys for tag colors and sync state. There's no cloud sync and no shared config file; copy a profile by hand if you need it on another machine.

Open Settings from the **gear** button in the top bar. Every change saves the moment you make it — there's no Save button, and closing the dialog (the **×**, `Esc`, or clicking outside) keeps what you set.

> [!NOTE]
> Because settings live in `localStorage`, clearing your browser/WebView data for ytnt resets everything to defaults. Your videos and notes are safe — those live in the SQLite database, not here. See [Troubleshooting](troubleshooting.md) for where each piece of data lives.

## At a glance

| Section | What it controls |
| --- | --- |
| **[Appearance](#-appearance)** | Color theme and whether the OS title bar is stripped. |
| **[Capture](#-capture)** | Auto-pause on note, and how many seconds before your keypress the timestamp lands. |
| **[Storage & backup](#-storage--backup)** | The Markdown vault folder, plus JSON export/import of your whole library. |
| **[Phoneme](#-phoneme)** | Path to the Phoneme CLI and two-way tag sync. |
| **[YouTube account](#-youtube-account)** | Connect/disconnect Google, or supply your own OAuth client. |
| **[Updates](#-updates)** | Check for a new app version. |

Each section below names the underlying field in `ytnt.settings` and its default, so power users editing storage by hand know exactly what to touch.

## 🎨 Appearance

| Area | What it controls |
| --- | --- |
| **Theme** (`theme`, default `catppuccin-mocha`) | The full color palette, grouped into **Dark** and **Light**. |
| **Strip system title bar** (`stripTitlebar`, default off) | Removes the OS title bar and window buttons for a borderless window. |

**Theme** is a dropdown split into a **Dark** group and a **Light** group. The available themes are:

| Group | Themes |
| --- | --- |
| **Dark** | Catppuccin Mocha, Catppuccin Macchiato, Catppuccin Frappe, Tokyo Night, Dracula, Nord, Gruvbox, Everforest, Kanagawa, One Dark, Rose Pine |
| **Light** | Catppuccin Latte, Tokyo Night Day, Gruvbox Light, Rose Pine Dawn, Solarized Light |

Pick one and the whole app re-tints instantly. Catppuccin Mocha is the default because it's the family ytnt's accent color is drawn from, so colored tags look at home out of the box.

**Strip system title bar** gives you a clean, borderless window with no OS chrome — handy for tiling and keyboard-driven window managers. When it's on, use your OS shortcuts to move and close the window.

> [!NOTE]
> On Windows, turning **Strip system title bar** back **off** may need an app restart before the title bar returns.

The deep dive on themes and the borderless window — including how it interacts with fullscreen — is in [Appearance & window](appearance_and_window.md).

## ⏱️ Capture

| Area | What it controls |
| --- | --- |
| **Auto-pause when adding a note** (`autopause`, default on) | Pauses the video the instant you start a note and resumes when you're done. |
| **Capture offset (seconds)** (`offset`, default `3`, range `0`–`30`) | How far *before* your keypress the note's timestamp is anchored. |

**Auto-pause when adding a note** stops playback the moment you hit capture so you can type without the video running away, then plays again once you save or cancel the new note. Turn it off if you'd rather keep watching while you jot.

**Capture offset (seconds)** backdates each new note's timestamp by the number of seconds you set, so the note lands on the moment you reacted to rather than the moment you finished reaching for the keyboard. The default of `3` works for most people; bump it up if you tend to catch up to things, or set `0` for an exact-to-the-second anchor. Allowed values are `0`–`30`.

Both settings shape the note-taking flow described in [Taking notes](taking_notes.md).

## 💾 Storage & backup

| Area | What it controls |
| --- | --- |
| **Vault folder** (`vaultDir`, default empty) | Destination folder for the **Save to vault** Markdown export. |
| **Library backup** | One-click **Export JSON** / **Import JSON** of your entire library. |

**Vault folder** is where the **Save to vault** action writes a Markdown file of the current video's notes — point it at, say, an Obsidian vault. Use **Browse…** to pick a folder, or paste a path. Once a folder is set, **Open** reveals it in your file manager.

> [!TIP]
> Leave the vault folder blank if you don't use it. The per-video **Copy Markdown** and **Download .md** actions work regardless of this setting — the vault is only for the "save straight into a folder" shortcut.

**Library backup** is your full safety net:

1. Click **Export JSON** to download a single `ytnt-backup.json` containing every video, note, tag, and link.
2. To restore (or move to another machine), click **Import JSON** and choose a backup file.

> [!IMPORTANT]
> Import **merges** the backup into your current library rather than wiping it. Keep periodic JSON exports — they capture data that lives in the database, which the in-app settings reset does **not** touch.

More on exports, the vault, and Markdown formatting is in [Library & filters](library_and_filters.md).

## 🔌 Phoneme

Phoneme is the optional sibling transcription app. These two settings only matter if you use it — ytnt works fully without Phoneme installed.

| Area | What it controls |
| --- | --- |
| **Phoneme CLI path** (`phonemeBin`, default empty / auto-detect) | Where ytnt finds the Phoneme executable. |
| **Sync tags with Phoneme** (`syncTags`, default on) | Two-way tag membership sync for videos you've sent to Phoneme. |

**Phoneme CLI path** can stay blank — ytnt auto-detects Phoneme by checking your `PATH` and then a local build. Set an explicit path (for example `C:\…\phoneme.exe`) to pin transcription to a stable release build so it keeps working even while you rebuild Phoneme from source. Changing this re-probes Phoneme immediately, so the transcript panel reflects the new binary right away.

**Sync tags with Phoneme** keeps tags in lock-step for any video you've transcribed in Phoneme: tagging a linked video here attaches that tag in Phoneme, and tags added in Phoneme show up here. Edits you make while Phoneme is closed are queued and sync the next time it's running, so nothing is lost when the daemon is down.

> [!NOTE]
> Tag sync is bidirectional, but **Phoneme owns the tag catalog** — colors and the canonical tag list flow from Phoneme into ytnt. Local color picks still win for ytnt-only tags. See [Tags](tags.md) for how colors resolve.

The full integration — sending a video to transcribe, comparing transcript versions, summaries, and chapters — is covered in [Phoneme integration](phoneme_integration.md).

## ▶️ YouTube account

Connecting your YouTube (Google) account lets ytnt list your playlists in the sidebar, toggle videos in and out of your library, remove a video from a playlist, and pull metadata like view counts and durations. It's entirely optional — you can use ytnt with plain YouTube URLs and never connect anything.

| State | What you see | What it does |
| --- | --- | --- |
| **Disconnected** | **Connect YouTube** button | Starts Google sign-in; authorize in your browser. |
| **Connected** | **Disconnect** button | Revokes the local session and clears loaded playlists. |

**To connect**, click **Connect YouTube**. Sign-in opens in your browser via a local loopback flow; once you authorize, your playlists appear in the sidebar — click one to import its videos.

**To disconnect**, click **Disconnect** in the **Connected** state. Your imported videos and notes stay put; only the live account link goes away.

> [!NOTE]
> **Watch Later** and **History** aren't available through YouTube's API, so they won't appear among your playlists no matter how you connect.

### Use my own Google client (advanced)

When no account is connected, an **Use my own Google client (advanced)** section lets you supply your own OAuth credentials instead of the app's built-in client:

| Field | Maps to | Notes |
| --- | --- | --- |
| **Client ID** (`gClientId`) | Your OAuth client ID | Looks like `xxxxx.apps.googleusercontent.com`. |
| **Client secret** (`gClientSecret`) | Your OAuth client secret | Stored only on this device. |

To create your own credentials, make a Google Cloud OAuth **Desktop app** client and enable the **YouTube Data API v3**. Your client overrides the app's built-in one.

> [!NOTE]
> Some builds ship with a built-in client and some don't. If this build has no built-in client, the **Connect** help text says so and you'll need to add your own here to connect at all.

The end-to-end account and playlist workflow lives in [YouTube account & playlists](youtube_account_and_playlists.md).

## 🔄 Updates

| Area | What it controls |
| --- | --- |
| **App updates** | **Check for updates** triggers an immediate update check. |

Click **Check for updates** to ask whether a newer ytnt release exists. If one is found, it downloads and installs in the background; restart the app to apply it. If you're current, you'll see a quick confirmation.

## Manual editing

All of these settings serialize to one JSON object in `localStorage` under `ytnt.settings`. A couple of related keys live alongside it:

| Key | Holds |
| --- | --- |
| `ytnt.settings` | Every field on this page (`offset`, `autopause`, `vaultDir`, `theme`, `stripTitlebar`, `gClientId`, `gClientSecret`, `hiddenPlaylists`, `phonemeBin`, `syncTags`). |
| `ytnt.tagColors` | Your local tag color overrides. |
| `ytnt.tagSyncBase` | Per-video snapshots used as the base for the three-way tag merge. |

The defaults, if a field is missing, are: `offset` `3`, `autopause` on, `vaultDir` empty, `theme` `catppuccin-mocha`, `stripTitlebar` off, `gClientId`/`gClientSecret` empty, `hiddenPlaylists` empty, `phonemeBin` empty, `syncTags` on.

> [!TIP]
> You almost never need to edit `localStorage` by hand — every value above is exposed in the dialog. Prefer the UI; it re-applies the theme, window decorations, and Phoneme probe for you on change.

> [!WARNING]
> Clearing this app's site/WebView storage erases all three keys above and reverts settings to defaults. This does **not** delete your videos or notes (those are in the SQLite database), but you will lose vault path, tag colors, and your connected-account session. Export a JSON backup first if in doubt.

## See also

- [Taking notes](taking_notes.md) — how **Capture** offset and auto-pause shape note-taking.
- [Appearance & window](appearance_and_window.md) — themes and the borderless window in depth.
- [Tags](tags.md) — tag colors and how local vs. Phoneme colors resolve.
- [Phoneme integration](phoneme_integration.md) — transcription, transcript views, and tag sync.
- [YouTube account & playlists](youtube_account_and_playlists.md) — connecting Google and importing playlists.
- [Library & filters](library_and_filters.md) — JSON export/import and Markdown export.
- [Keyboard shortcuts](keyboard_shortcuts.md) — every shortcut (press `?` in-app for the cheat sheet).
- [Troubleshooting](troubleshooting.md) — where each piece of data lives and how to recover it.
