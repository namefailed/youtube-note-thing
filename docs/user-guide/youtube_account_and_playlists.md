# 🔗 YouTube account & playlists

Connecting your Google account turns ytnt from a paste-a-link notebook into a browser for your own YouTube library: your playlists show up in the sidebar, you can pull any video into your library (or push it back out), trim a video out of a playlist once you've finished taking notes, and let your library cards fill themselves in with channel, view count, length, and publish date. The link is **optional** — everything else in ytnt works without it — and your tokens never leave this machine (they live in `%APPDATA%\dev.ytnt.app\google_tokens.json`).

> [!NOTE]
> Watch Later and History are **not** exposed by YouTube's API, so they can't appear here. Only real playlists you own show up. For a public or unlisted playlist you don't own, paste its link into the add bar instead — see [Library & filters](library_and_filters.md).

## 🔑 What access is used

ytnt uses Google's standard installed-app OAuth flow with the single scope `https://www.googleapis.com/auth/youtube` — **read and write**. Read is what lists your playlists, reads playlist contents, and pulls video metadata. Write is what lets ytnt delete a playlist entry on your behalf (removing a video from a playlist). Sign-in happens in your real browser; ytnt only ever sees the resulting tokens.

| Capability | Access | Used for |
| --- | --- | --- |
| **List playlists** | read | The **Playlists** group in the sidebar |
| **Read playlist items** | read | Browsing a playlist, the **in-library** flag |
| **Video metadata** | read | Channel, views, duration, publish date on library cards |
| **Remove playlist item** | write | Dropping a video from a playlist |

> [!IMPORTANT]
> The full `youtube` scope is required because removing a playlist entry is a write operation. A read-only scope would let you browse but fail with a "need write access?" error the moment you try to remove anything.

## 🚀 Connecting a Google account

You connect either with the app's **built-in client** (the common path) or with **your own** Google Cloud OAuth client (advanced). Both end in the same place: a browser consent screen, then a connected account.

1. Open **Settings → YouTube account**.
2. Click **Connect YouTube**.
3. Your browser opens Google's sign-in. Pick the account and approve the access.
4. The browser shows a small "Connected ✓ — you can close this tab" page. Return to ytnt; the status flips to **Connected** and your playlists load into the sidebar.

If a build ships with a built-in client, Settings says *"Uses the app's built-in YouTube access — sign-in opens in your browser."* If it doesn't, you'll see *"No built-in client in this build — add your own below"* and must use the advanced path before **Connect YouTube** will work.

### Using your own Google client (advanced)

Bring your own OAuth client if you'd rather not rely on the bundled one, or if the build has none.

1. In the [Google Cloud Console](https://console.cloud.google.com), create an OAuth **Desktop app** client and enable **YouTube Data API v3**.
2. In ytnt, open **Settings → YouTube account** and expand **Use my own Google client (advanced)**.
3. Paste your **Client ID** (looks like `xxxxx.apps.googleusercontent.com`) and **Client secret** (looks like `GOCSPX-…`).
4. Click **Connect YouTube**.

Your own credentials **override** the built-in client and are stored only on this device — as the `gClientId` / `gClientSecret` fields inside the `ytnt.settings` localStorage object. See [Settings reference](settings_reference.md) for where these live.

> [!TIP]
> If you ever see *"Google did not return a refresh token"*, remove ytnt from your Google account's third-party access list and connect again — Google only hands out a refresh token on a fresh consent.

## 📺 Browsing playlists

Once connected, a **Playlists** group appears in the left sidebar with each playlist and its item count.

1. Click a playlist to open it. ytnt fetches its current contents from YouTube and shows them as cards (thumbnail + title) in the middle pane.
2. Each card is clickable — click anywhere on the card to load that video and start taking notes (this also adds it to your library).
3. Click the same playlist again, or the **Close** button at the top of the list, to leave the playlist view and return to your normal library.

A spinner ("Loading …") shows while contents are fetched. An empty or unavailable playlist shows *"This playlist is empty or unavailable."*

## ➕ Toggling videos in and out of your library

Inside a playlist, each card has a toggle button on the right that reflects whether that video is already in your local library:

| Button | State | Action on click |
| --- | --- | --- |
| **+** (plus) | Not in library | Adds the video to your library |
| **✓** (check) | In library | Removes the video from your library |

The toggle only touches your **local** library — it never changes the playlist on YouTube. Hover text spells this out: *"In your library — click to remove from library"* vs *"Add to library"*.

> [!NOTE]
> Removing a video from your library this way drops its row and any notes you took on it. To remove it from the **playlist** instead while keeping it (and your notes) in the library, use the remove-from-playlist button below.

## ✂️ Removing a video from a playlist

This is the "I'm done taking notes — drop it from my to-do playlist" workflow. It removes the entry from the real YouTube playlist but keeps the video (and your notes) in your library.

1. Open the playlist and find the video.
2. Click the **✕** (remove) button on its card — hover text: *"Remove from "<playlist>" (keeps it in your library)"*.
3. A confirmation dialog appears: **Remove "<title>" from "<playlist>"? It stays in your library.** Confirm to proceed.
4. ytnt deletes the playlist entry on YouTube, drops the card from the open list, and ticks the playlist's count down by one. You'll see a **Removed from "<playlist>"** toast.

> [!WARNING]
> This deletes the entry from your real YouTube playlist — it is a write to your account and isn't undone by ytnt. The video itself and its notes stay in your local library; only the playlist membership is removed.

There's a second place this happens: when you **delete a video from your library** ([Library & filters](library_and_filters.md)), if that video is in any synced playlists, ytnt asks **Also remove it from your YouTube playlist(s): <names>?** — answer **No** to keep it on the playlist, **Yes** to clean both up at once.

## 📊 View-count & metadata backfill

Library cards show channel, view count, length, and publish date. When you're connected, ytnt fills these in automatically:

- On startup and whenever you connect, it backfills metadata for every library video that's missing it.
- When you open or add a new video, it backfills that one too.

The backfill is batched (50 videos per request), idempotent, and only touches videos that don't have a view count yet — so it's cheap and won't re-fetch what's already cached. If you're offline or hit an API quota, cards simply keep whatever they already had; nothing breaks.

> [!TIP]
> Imported a big playlist while disconnected and the cards look bare? Connect your account — the backfill runs on connect and fills them in. See [Library & filters](library_and_filters.md#card-actions) for what the card fields mean.

## 👁️ Show / hide playlists (the gear)

If you have playlists you never want cluttering the sidebar, hide them:

1. In the sidebar's **Playlists** header, click the **gear** icon ("Show / hide playlists").
2. A list of all your playlists appears; click any one to toggle its visibility. A shown playlist has an **eye** icon; a hidden one has an **eye-off** icon.
3. Hidden playlists disappear from the browse list but stay in the gear menu so you can bring them back.

Hidden playlist ids are remembered in your settings (`hiddenPlaylists`). Hiding the playlist you're currently browsing closes the browse view.

## 🔌 Disconnecting

To sign out:

1. Open **Settings → YouTube account**.
2. Click **Disconnect**.

This removes the stored tokens (`google_tokens.json`) and clears your playlists from the sidebar. You'll see a **Disconnected** toast. Your library, notes, and any videos you pulled in stay exactly as they are — disconnecting only severs the live link to YouTube. Reconnect any time with **Connect YouTube**.

## See also

- [Library & filters](library_and_filters.md) — pasting playlist links, library cards, deleting videos
- [Taking notes](taking_notes.md) — what happens once a video is loaded
- [Settings reference](settings_reference.md) — where the `gClientId`, `gClientSecret`, and `hiddenPlaylists` fields in `ytnt.settings` are stored
- [Troubleshooting](troubleshooting.md) — connection, token, and quota problems
- [Phoneme integration](phoneme_integration.md) — the other optional integration
