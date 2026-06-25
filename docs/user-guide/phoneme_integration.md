# 🎙️ Phoneme integration

[Phoneme](https://github.com/) is a separate local transcription app. When it's installed and running alongside youtube-note-thing, you can hand a video to it, get back a real transcript with timestamps, compare the pipeline's cleanup steps side by side, read its summary and chapters, and keep your tags in sync — all without leaving ytnt. It's completely **optional**: ytnt is a full notes app on its own, and everything below simply switches off (gracefully) when Phoneme isn't there.

This page covers how ytnt finds Phoneme, the health indicator, sending a video to transcribe, reading the result, [tag sync](#-tag-sync), and the [CLI path setting](#-the-phoneme-cli-path-setting). If you only want notes and playlists, you can skip the whole thing.

## 📦 What needs Phoneme — and what doesn't

ytnt never bundles or requires Phoneme. The two apps talk over Phoneme's own CLI (and, where available, its local REST and daemon pipe), so if the `phoneme` binary isn't found, the integration just stays dark.

| Works **without** Phoneme | Needs Phoneme running |
| --- | --- |
| Timestamped [notes](taking_notes.md), resume position, auto-pause | A real transcript (cleaned text + speaker turns + timing) |
| The whole [library, filters, and search](library_and_filters.md) | [Compare](#comparing-pipeline-versions), [Summary](#summary-entities-and-tasks), and [Chapters](#chapters) views |
| [Colored tags](tags.md) and the Tag Manager | [Bidirectional tag sync](#-tag-sync) |
| Markdown export / JSON import-export | Phoneme results showing up in the all-notes search |
| The [YouTube account + playlists](youtube_account_and_playlists.md) features | — |
| **Best-effort YouTube captions** (see below) | — |

> [!NOTE]
> Even with Phoneme absent, the **Transcript** tab still offers **Load YouTube captions** — a best-effort grab of the video's own caption track. It's fragile (many videos have none, and YouTube changes the endpoint), so treat it as a fallback. Install Phoneme for reliable transcripts.

## 🟢 The health indicator

A small colored dot sits at the far right of the top bar, next to the **Settings** gear. ytnt re-checks Phoneme on launch and then every 15 seconds, so the dot reflects live state — start or stop Phoneme mid-session and the dot follows. Hover it for the exact status.

| Dot | Hover text | What it means |
| --- | --- | --- |
| **Green** | `Phoneme connected` (plus the version, if known) | The CLI is found **and** its daemon answered — every feature is available. |
| **Amber** | `Phoneme installed — daemon not responding` | ytnt found the binary, but the background daemon isn't up. Start (or check) Phoneme. Transcription is unavailable until it answers. |
| **Off (dim)** | `Phoneme not detected` | No `phoneme` binary on PATH or at a known location. The integration is disabled; captions still work. |

> [!TIP]
> If the dot is green but a transcript panel shows a "looks older than this app expects" warning, your Phoneme is too old. ytnt was built against a minimum Phoneme version and degrades **loudly** rather than showing blank panels — [update Phoneme](#phoneme-looks-older-than-this-app-expects) to clear it.

## 🚀 Send a video to transcribe

1. Open a video and switch to the **Transcript** tab (next to **Notes**).
2. If the video isn't linked to Phoneme yet, click **Transcribe with Phoneme**. (This button only appears when the dot is green.)
3. ytnt hands the video's URL to Phoneme, which downloads the audio and queues it. You'll see a flash: **Sending to Phoneme — downloading + queuing…**, then **Queued — transcribing in Phoneme**.
4. The tab now shows live pipeline progress. Leave it open — it updates itself.

Behind the scenes ytnt stores the new recording's id on the video, so the link survives restarts. Once a video is linked, the **Transcribe** button is replaced by the transcript itself.

### Choosing a pipeline (recipe)

If you've configured custom **Playbook recipes** in Phoneme, a **Recipe** dropdown appears next to **Transcribe with Phoneme**. Pick one to run the transcription through that recipe in a single pass (no separate re-run needed); your choice is remembered. The dropdown only shows when you have more than the built-in **Default** recipe, and it lists only recording-scope recipes (meeting templates don't apply to a single video). Leave it on **Default** for the standard pipeline.

> [!NOTE]
> Downloading the audio happens up front and can take a moment for long videos; the flash stays up until Phoneme has accepted the job.

### Pipeline stages

While a recording is in flight, the Transcript tab shows the current stage. ytnt prefers Phoneme's live progress stream when it's reachable and otherwise polls every few seconds, so the label tracks reality either way.

| Stage label | What's happening |
| --- | --- |
| **Queued…** | Waiting for a transcription slot. |
| **Transcribing…** | Speech-to-text is running. |
| **Cleaning up the transcript…** | A pipeline step is polishing the raw text. |
| **Summarizing…** | Generating the summary. |
| **Tagging…** | Phoneme is attaching its own tags. |
| **Running hooks…** | User-defined Phoneme hooks are running. |
| **A step failed — the transcript may still be usable** | An optional step errored. This is **not** a total failure — the transcript and earlier outputs are usually fine. |
| **Cancelled** | The job was cancelled in Phoneme. |

> [!IMPORTANT]
> An optional-step failure (the `_failed` states) does **not** mean a broken transcript. ytnt still pulls whatever the pipeline produced — text, versions, chapters, and summary may all be present.

## 📖 Read the transcript

When the recording reaches a terminal state (**done**, a failed step, or cancelled), the Transcript tab swaps the progress view for sub-tabs:

| Sub-tab | What it shows |
| --- | --- |
| **Transcript** | The timestamped segments. Click any line to jump the player to that moment. |
| **Chapters** | Auto-generated chapters (only appears when the recording has them). |
| **Compare** | Every transcript version side by side. |
| **Summary** | Phoneme's summary, plus entities, tasks, and recording metadata. |

Use the small refresh button in the detail header (titled **Refresh from Phoneme**) to re-pull at any time.

### Timestamped segments

The **Transcript** sub-tab lists each segment with its start time and any detected speaker. Each line is a button — click it to **seek the video** there, the same way clicking a note timestamp works. If the recording has cleaned text but no per-segment timing, ytnt falls back to showing the flowing transcript text.

### Chapters

If Phoneme generated chapters for the recording, a **Chapters** sub-tab appears (with the count). Each chapter shows its start time, title, and an optional one-line summary, and clicking it seeks the player. This view is read-only — opening it never triggers Phoneme to regenerate anything.

### Comparing pipeline versions

Phoneme's transcript is built in a chain: the raw speech-to-text output, then each cleanup/pipeline step on top of it. The **Compare** sub-tab puts two of those versions side by side with a dropdown over each column, so you can see exactly what a cleanup pass changed. The label includes the model used for each version where known.

If the recording ran a plain transcribe with no extra steps, Compare simply says there are no alternate versions — that's normal, not an error.

### Summary, entities, and tasks

The **Summary** sub-tab shows:

- **Summary** — Phoneme's generated summary of the recording.
- **Entities** — names, places, and other items Phoneme extracted (hover one to see its kind).
- **Tasks** — any action items Phoneme found, with done/undone styling.
- A metadata line at the bottom: the model, detected language, and mean confidence (as a percentage) when available.

Any section with no data is simply omitted.

## 🏷️ Tag sync

Phoneme is the **tag authority**. ytnt mirrors its tag colors so a shared tag looks identical in both apps, and — for videos you've sent to Phoneme — keeps tag *membership* in sync **both ways**:

- Tag a linked video in ytnt → the tag is attached to its recording in Phoneme (created there first if it's new, carrying its color).
- Add a tag to that recording in Phoneme → it shows up on the video in ytnt.

Sync is a true three-way merge against a per-video snapshot, so it won't clobber changes made in either app, and edits you make while Phoneme is closed are reconciled the next time it's running. Renaming a synced tag in ytnt's [Tag Manager](tags.md) also renames it globally in Phoneme (keeping its id and every attachment, so nothing gets orphaned).

This is controlled by **Settings → Phoneme → Sync tags with Phoneme** (on by default). There's also a manual **Sync all** button in the Tag Manager that pulls and pushes tags for every video you've sent to Phoneme — it's disabled while Phoneme isn't running.

> [!NOTE]
> Tag sync only touches videos that are linked to a Phoneme recording. Tagging a video you never transcribed is purely local. There is no daemon or tag catalog inside ytnt — Phoneme owns the vocabulary; ytnt mirrors it.

See [Tags](tags.md) for the full tag/color picker and Tag Manager, and the [Settings reference](settings_reference.md) for every related option.

## ⚙️ The Phoneme CLI path setting

ytnt finds the Phoneme binary automatically in most cases. If yours lives somewhere unusual, point ytnt at it under **Settings → Phoneme → Phoneme CLI path**.

- **Leave it blank** to auto-detect. ytnt checks, in order: this setting, the `PHONEME_BIN` environment variable, your `PATH`, a `cargo install` location, then the usual local dev-build folders.
- **Set an explicit path** (for example `C:\…\phoneme.exe`) to override detection entirely.

The path is saved with your other [settings](settings_reference.md) and pushed to the backend immediately, so changing it re-probes Phoneme on the spot — watch the health dot.

> [!TIP]
> **Point it at a stable release build.** If you also develop Phoneme, your local dev build comes and goes as you rebuild it. Aiming this setting at a stable, installed `phoneme` keeps transcription working in ytnt even while you're rebuilding Phoneme from source.

## 🛠️ Troubleshooting

### "Phoneme isn't running"

> Phoneme isn't running

You tried a Phoneme action (like the Tag Manager's **Sync all**) while the daemon was down — the health dot is amber or off.

> [!TIP]
> **Fix:** Start Phoneme and wait for its daemon to come up; the health dot turns green within ~15 seconds. If the dot is off entirely, ytnt can't find the binary — set the [Phoneme CLI path](#-the-phoneme-cli-path-setting).

### "Phoneme not detected"

The health dot is dim and the Transcript tab offers only **Load YouTube captions**.

> [!TIP]
> **Fix:** Install Phoneme, or point ytnt at an existing install via **Settings → Phoneme → Phoneme CLI path**. Until then, ytnt works fully as a notes app; only the transcript/summary/chapters/sync features are hidden.

### "This video is linked to a Phoneme recording that no longer exists"

ytnt asks whether to unlink a video whose recording was deleted in Phoneme.

> [!TIP]
> **Fix:** Confirm to unlink — the video stays in your library and you can **Transcribe with Phoneme** again to make a fresh recording.

### "Phoneme looks older than this app expects"

> ⚠ Phoneme (version) looks older than this app expects — transcript panels may be empty or wrong. Please update Phoneme.

The health dot may be green, but your Phoneme is below the minimum version ytnt's transcript features were built against, so panels can come up blank or wrong.

> [!TIP]
> **Fix:** Update Phoneme to a current release. (A build with no reported version is treated as compatible, so you won't be locked out for that alone.)

### A transcript panel is empty

Nothing in the **Transcript**, **Compare**, or **Chapters** views.

> [!NOTE]
> This is often normal. A still-transcribing recording has no segments yet, and a plain transcribe produces no extra **Compare** versions or **Chapters**. Use **Refresh from Phoneme** in the detail header, and check the health dot. If panels stay empty on a finished recording with an up-to-date Phoneme, ytnt will surface a version-mismatch notice when it detects one.

See the full [Troubleshooting](troubleshooting.md) guide for everything else.

## See also

- [Getting started](getting_started.md) — install ytnt and load your first video.
- [Taking notes](taking_notes.md) — timestamped notes that pair with transcripts.
- [Tags](tags.md) — the tag/color picker and Tag Manager that sync with Phoneme.
- [YouTube account and playlists](youtube_account_and_playlists.md) — the other optional integration.
- [Settings reference](settings_reference.md) — the **Phoneme** settings section in full.
- [Integrations (developer guide)](../developer-guide/integrations.md) — how ytnt resolves and talks to Phoneme under the hood.
