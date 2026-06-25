# 🛟 Troubleshooting & FAQ

Most of youtube-note-thing runs entirely on your machine, so when something goes sideways the cause is usually local: an optional integration that isn't connected, a Google credential that needs a nudge, or a stray process holding a port. This page walks the symptoms you're most likely to hit, top to bottom by how often they come up, and ends with a short [FAQ](#-faq).

Before anything else: your data is safe. Notes, videos, and tags live in a single SQLite file (see [Where is everything?](#-where-is-everything)), and nothing here touches it except the last-resort factory reset, which is clearly flagged.

> [!TIP]
> New here? Start with [Getting started](getting_started.md). For what every setting does, see the [Settings reference](settings_reference.md).

---

## 🟡 The status dot is yellow or grey — Phoneme isn't detected

The small dot in the top-right of the toolbar reports the [Phoneme](phoneme_integration.md) integration's health. Hover it for the exact state. Phoneme is **optional** — the app works fully without it; you just won't get cleaned transcripts, summaries, chapters, or tag sync until it's connected.

| Dot | Hover text | What it means |
| --- | --- | --- |
| **Green** | "Phoneme connected" (plus version) | The CLI is found and its daemon answered. Everything is available. |
| **Yellow** | "Phoneme installed — daemon not responding" | The `phoneme` binary was found, but its background daemon isn't running. |
| **Grey** | "Phoneme not detected" | No `phoneme` binary on `PATH` (and no override set). |

The same states show up inside the **Transcript** tab when a video isn't linked yet:

> Phoneme is installed but its daemon isn't responding — start it (or check it) to transcribe. Captions are best-effort meanwhile.

> Phoneme not detected — captions are best-effort. Install Phoneme for full transcripts, summaries and more.

**How the app finds Phoneme** (in order): the **Settings → Phoneme → Phoneme CLI path** override, then the `PHONEME_BIN` environment variable, then your `PATH`, then a `cargo install` location, then a local Phoneme dev build. The app re-checks every 15 seconds, so starting Phoneme mid-session flips the dot green on its own — no restart needed.

> [!TIP]
> **Fix (grey dot — not found):** Confirm Phoneme is installed and on your `PATH`:
> ```powershell
> phoneme version
> ```
> If that prints a version but the app still shows grey, the app isn't seeing your `PATH`. Set an explicit path in **Settings → Phoneme CLI path** (e.g. `C:\…\phoneme.exe`) — it's saved immediately and the app re-probes.

> [!TIP]
> **Fix (yellow dot — daemon not responding):** The CLI is found but the daemon isn't answering a `list`. Start Phoneme (or its daemon) the way you normally do, then wait a few seconds for the dot to turn green. Confirm from a terminal:
> ```powershell
> phoneme list --limit 1
> ```
> If that hangs or errors, the problem is on the Phoneme side, not here.

### ⚠ "Phoneme … looks older than this app expects"

If Phoneme is present but reports a version below the minimum this app was built against (currently **1.8**), a loud inline banner appears in the Transcript tab:

> ⚠ Phoneme x.y.z looks older than this app expects — transcript panels may be empty or wrong. Please update Phoneme.

> [!IMPORTANT]
> This is the app degrading **loudly** on purpose, rather than showing silently blank panels. An unknown/unparseable version is treated as compatible (you won't be locked out) — only a version we can read *and* know is too old triggers the banner.

> [!TIP]
> **Fix:** Update Phoneme to a recent build. The version we saw is shown in the banner and on the green-dot hover.

#### Transcript versions say "only available on Windows for now"

Some Phoneme features (the full transcript-version comparison) can fall back to Phoneme's daemon named pipe, which today exists **only on Windows**. On other platforms, if the CLI and the optional REST API both can't serve versions, you'll see a notice that the feature isn't available on this OS yet. Windows is the primary platform, so this only affects non-Windows builds.

See also: [Phoneme integration](phoneme_integration.md).

---

## 🔗 Connecting your YouTube account fails

The app links to YouTube with Google's installed-app OAuth flow: it opens a consent page in your browser, you approve, and a tab confirms **"Connected ✓"**. If that doesn't happen, one of the cases below usually applies. The connect path lives in **Settings → YouTube account → Connect YouTube**.

> [!NOTE]
> **Watch Later and History are never available** — YouTube's Data API simply doesn't expose them. Only your real playlists show up. That's a platform limitation, not a bug.

### "Access blocked", 403, or an unverified-app screen

If you bring **your own** Google Cloud OAuth client (the **Use my own Google client (advanced)** section), Google may block sign-in until your project is configured:

> [!TIP]
> **Fix:** In Google Cloud Console:
> 1. Create an OAuth client of type **Desktop app** (not "Web application").
> 2. Enable the **YouTube Data API v3** for the project.
> 3. On the OAuth consent screen, add your Google account as a **Test user** (a project in "Testing" only allows listed test users).
>
> Paste the **Client ID** (`…apps.googleusercontent.com`) and **Client secret** (`GOCSPX-…`) into **Settings → YouTube account → Use my own Google client**. They're stored only on this device and override the built-in client.

> [!NOTE]
> If this build ships with a built-in client, you can skip all of that and just click **Connect YouTube**. The Settings help text tells you which case you're in: "Uses the app's built-in YouTube access" vs. "No built-in client in this build — add your own below."

### "Google did not return a refresh token"

Seen as a toast right after consent:

> Google did not return a refresh token. Remove this app from your Google account's third-party access and try again.

This happens when Google remembers a prior grant and skips re-issuing the long-lived refresh token the app needs to stay connected.

> [!TIP]
> **Fix:** Go to your Google Account → **Security → Third-party access**, remove this app, then click **Connect YouTube** again to get a fresh consent.

### "Couldn't remove from playlist (need write access?)"

Removing a video from a real YouTube playlist needs write permission on the account. The app requests the full `youtube` scope (read + write) at connect time.

> [!TIP]
> **Fix:** Disconnect and reconnect so the new consent grants write access. **Settings → YouTube account → Disconnect**, then **Connect YouTube**, and approve the permissions when prompted.

### "Session expired — reconnect your Google account"

The stored access token expired and couldn't be refreshed (no refresh token, or Google rejected it).

> [!TIP]
> **Fix:** Disconnect and reconnect. The same applies to "Token refresh failed — reconnect your Google account."

See also: [YouTube account & playlists](youtube_account_and_playlists.md).

---

## 🏷️ Tags aren't syncing with Phoneme

Tag membership sync is **bidirectional** but only runs when two conditions hold: **Sync tags with Phoneme** is on (**Settings → Phoneme**, default on) *and* Phoneme is reachable (green dot). Sync also only touches videos that are **linked** to a Phoneme recording — sending a video to Phoneme creates that link.

When Phoneme is down, local tag edits aren't lost: they're queued against a per-video snapshot and pushed automatically the next time the daemon reappears. You can also force a full pull+push from the **Tag Manager → Sync all** button.

> [!NOTE]
> Phoneme is the **tag-catalog authority**. The app mirrors Phoneme's tag colors on shared tags, but your local color picks win for tags that only exist here. Nothing is detached behind your back: if the daemon is briefly unreachable mid-sync, the change stays pending rather than wiping the other side's tags.

> [!TIP]
> **Fix:** Run down this checklist:
> 1. **Settings → Phoneme → Sync tags with Phoneme** is enabled.
> 2. The status dot is **green** (Phoneme reachable). If not, see [Phoneme isn't detected](#-the-status-dot-is-yellow-or-grey--phoneme-isnt-detected).
> 3. The video is **linked** — open it and confirm it has a Phoneme recording (the Transcript tab shows the recording, not a "Transcribe" prompt).
> 4. Click **Sync all** in the Tag Manager. If Phoneme isn't running you'll get a "Phoneme isn't running" toast.

See also: [Tags](tags.md), [Phoneme integration](phoneme_integration.md).

---

## 📊 Library cards show no channel, views, duration, or publish date

That metadata comes from the YouTube Data API and needs a **connected Google account**. The app backfills it automatically for any video missing it, in batches, right after you connect and when you add new videos.

> [!TIP]
> **Fix:** Connect your account under **Settings → YouTube account → Connect YouTube**. Once connected, the cards fill in on their own. If they stay blank, you may be offline or have hit your daily API quota — the app leaves the cards as-is and tries again later, so just give it time or check back tomorrow.

> [!NOTE]
> Videos imported from a **public/unlisted** playlist link (the no-login path) come in with a title but no statistics until a connected account backfills them. This is expected.

See also: [Library & filters](library_and_filters.md).

---

## 🔌 The app won't start in dev — port 5191 is in use

In development the Vite dev server binds port **5191** with `strictPort` on, so it **won't silently pick another port** — it fails instead. (The port is deliberate: Phoneme's dev server uses 5173, and both can run at once.)

```
Port 5191 is already in use
```

> [!TIP]
> **Fix:** Find and stop whatever is holding the port, then re-run `npm run tauri dev`:
> ```powershell
> # Who owns 5191?
> Get-NetTCPConnection -LocalPort 5191 | Select-Object OwningProcess
> # Stop it (replace <pid> with the OwningProcess above)
> Stop-Process -Id <pid>
> ```
> Usually it's a previous `tauri dev` that didn't shut down cleanly. This only affects development — installed builds don't use a dev server.

See also: [Building from source](../developer-guide/building_from_source.md).

---

## 💥 "VersionMismatch" / migration panic on startup

If the app panics at startup while initializing the database with a `Migrate(VersionMismatch)` error, it means a migration file's checksum no longer matches what an existing database recorded.

> [!IMPORTANT]
> **As a regular user, you should never hit this.** It comes from *editing an already-committed migration* during development — sqlx checksums each migration by its exact bytes, so changing even a comment or a line ending breaks every existing database. Shipped releases only ever *add* new migrations, which apply cleanly on top of yours.

> [!NOTE]
> The repo guards against the most common cause: `.gitattributes` marks `src-tauri/migrations/*.sql` as `-text`, so Git treats them as binary for line endings and never normalizes or converts their endings (a CRLF↔LF flip changes the checksum). The committed bytes — and therefore the sqlx checksums — stay stable. Schema changes are made by adding a **new** migration file (`001_init` … `006_video_meta` today), never by editing an old one.

> [!TIP]
> **Fix (developers):** Revert the edited migration to its committed bytes and add your change as a *new* migration instead. If your **local dev** database is disposable, delete it so migrations re-run from scratch — see the [factory reset](#-factory-reset-start-completely-fresh) below. For the full story, see [Data model & migrations](../developer-guide/data_model_and_migrations.md).

---

## 📁 Where is everything?

Everything the app persists is in one of two places: the app data directory on disk, or your browser-style `localStorage` (preferences only).

| What | Where | Notes |
| --- | --- | --- |
| **Database** (videos, notes, tags, playlists) | `%APPDATA%\dev.ytnt.app\ytnt.db` | SQLite, WAL mode — you may also see `ytnt.db-wal` / `ytnt.db-shm` alongside it. |
| **Google tokens** | `%APPDATA%\dev.ytnt.app\google_tokens.json` | Removed when you disconnect your account. |
| **Settings** | `localStorage` key `ytnt.settings` | Offset, autopause, theme, vault folder, Google client, Phoneme path, sync toggle, hidden playlists. |
| **Tag color overrides** | `localStorage` key `ytnt.tagColors` | Your local color picks; win over Phoneme's. |
| **Tag-sync snapshots** | `localStorage` key `ytnt.tagSyncBase` | Per-video base for the 3-way tag merge / pending queue. |

> [!NOTE]
> `dev.ytnt.app` is the app's bundle identifier; the folder under `%APPDATA%` matches it. To open the data folder, paste `%APPDATA%\dev.ytnt.app` into Explorer's address bar.

> [!TIP]
> **Logs:** there's no separate log file. In development, backend diagnostics (e.g. a Phoneme output that couldn't be parsed) print to the terminal running `npm run tauri dev`. Run from a terminal to see them.

---

## 🧨 Factory reset (start completely fresh)

A clean slate means deleting the app data directory. This removes **everything**: all videos, notes, tags, playlists, and your YouTube connection.

> [!CAUTION]
> **This permanently deletes your notes and library.** There is no undo. **[Export a JSON backup first](library_and_filters.md)** (**Settings → Storage & backup → Export JSON / Import JSON**) if you might want any of it back — you can re-import that file later.

> [!CAUTION]
> Quit the app before deleting, then remove the folder:
> ```powershell
> Remove-Item -Recurse -Force "$env:APPDATA\dev.ytnt.app"
> ```
> On next launch the app recreates a fresh database from the migrations and you start empty. Your `localStorage` preferences (theme, etc.) are separate and survive this.

> [!TIP]
> To reset **only** the database (keeping Google tokens), delete just `ytnt.db` (and its `-wal` / `-shm` siblings) inside that folder.

---

## ❓ FAQ

**Do I need Phoneme to use the app?**
No. Phoneme is entirely optional. Without it you still get timestamped notes, the library, filters, search, find & replace, Markdown export, JSON import/export, themes, and the full YouTube-account features. Phoneme adds transcripts, summaries, chapters, semantic search, and tag sync. See [Phoneme integration](phoneme_integration.md).

**Do I need a Google account?**
No — only if you want to browse your playlists, toggle videos in and out of your library, remove playlist items, or pull view counts and other card metadata. You can paste any video or public playlist link and take notes without ever connecting. See [YouTube account & playlists](youtube_account_and_playlists.md).

**Where are my notes stored — is anything in the cloud?**
Locally, in `%APPDATA%\dev.ytnt.app\ytnt.db`. Nothing is uploaded. The only network calls are to YouTube/Google (when you opt in) and to your local Phoneme. See [Where is everything?](#-where-is-everything).

**Can I move my data to another machine?**
Yes. Use **Settings → Storage & backup → Export JSON / Import JSON** on the old machine and **Import JSON** on the new one. (Copying `ytnt.db` directly works too, into the same `%APPDATA%\dev.ytnt.app` folder while the app is closed.)

**Why can't I see Watch Later or my watch History?**
YouTube's Data API doesn't expose them, so no app can. Only your real playlists are available.

**The video player lost keyboard focus / shortcuts stopped working.**
Clicking inside the YouTube player can steal focus, but the app drives playback through the player's API and returns focus automatically, so shortcuts keep working. Press `?` any time for the in-app shortcut cheat sheet. See [Keyboard shortcuts](keyboard_shortcuts.md).

**How do I get app updates?**
**Settings → Updates → Check for updates**. If one is available it downloads and installs; restart to apply.

**The window has no title bar (or I want it back).**
That's the **Strip system titlebar** option. Toggle it under **Settings → Appearance**. See [Appearance & window](appearance_and_window.md).

---

## See also

- [Getting started](getting_started.md)
- [Settings reference](settings_reference.md)
- [Phoneme integration](phoneme_integration.md)
- [YouTube account & playlists](youtube_account_and_playlists.md)
- [Tags](tags.md)
- [Library & filters](library_and_filters.md)
- [Keyboard shortcuts](keyboard_shortcuts.md)
- [Data model & migrations](../developer-guide/data_model_and_migrations.md) (developers)
- [Building from source](../developer-guide/building_from_source.md) (developers)
