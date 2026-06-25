# Frontend guide

The whole UI is **one Lit 3 web component**. There is no router, no component
tree, no store library — the entire app is the `<ytnt-app>` custom element in
[`src/app.ts`](../../src/app.ts), backed by three small, single-purpose modules:

| File | Role | Tested? |
| --- | --- | --- |
| [`src/app.ts`](../../src/app.ts) | The Lit component: state, render, styles, all UI logic | — |
| [`src/api.ts`](../../src/api.ts) | Typed `invoke()` wrappers — the only place the frontend talks to Rust | — |
| [`src/lib.ts`](../../src/lib.ts) | Pure helpers (URL parsing, time formatting, tag merge) | yes — [`src/lib.test.ts`](../../src/lib.test.ts) |
| [`src/player.ts`](../../src/player.ts) | Thin wrapper over the YouTube IFrame Player API | — |
| [`src/markdown.ts`](../../src/markdown.ts) | Markdown → sanitized HTML for note rendering | — |

This guide traces how those fit together and how to add UI without fighting the
grain. It is the companion to the inline comments — the code is the source of
truth, so when prose and a file disagree, the file wins.

For the backend half of every `invoke`, see [backend_guide.md](./backend_guide.md);
for the IPC contract and where data lives, see
[data_model_and_migrations.md](./data_model_and_migrations.md). The big-picture
map is [architecture.md](./architecture.md).

---

## 1. The component (`src/app.ts`)

### One element, reactive state

`App` extends `LitElement` and is registered as `<ytnt-app>`:

```ts
@customElement("ytnt-app")
export class App extends LitElement { … }
```

Everything that drives a re-render is an `@state()` field. There is **no
`@property()`** — `<ytnt-app>` takes no attributes or external props, so all of
its state is private and internal. A representative slice:

```ts
@state() private videos: VideoWithCount[] = [];   // the library
@state() private currentId: string | null = null; // open video
@state() private notes: Note[] = [];               // notes for currentId
@state() private editing: Editing = null;          // open note editor (or null)
@state() private filter = "";                      // in-pane note search box
@state() private libView: "all" | "transcript" | "untagged" | "tagged" = "all";
@state() private tagFilter: string | null = null;  // active sidebar tag
@state() private view: "notes" | "transcript" = "notes"; // detail-pane tab
```

The pattern throughout: **mutate state by replacing it, then let Lit
re-render.** Arrays and objects are reassigned, never mutated in place
(`this.videos = await api.listVideos()`, `this.selected = new Set(...)`), because
Lit's dirty-check is identity-based. A few non-reactive fields are deliberately
plain (no `@state()`) so they *don't* trigger renders — `this.player`,
`this.settings`, `this.lastSaved`, and the various timer handles.

**Settings are not `@state()`.** They live on `this.settings` (a plain field
loaded by `loadSettings()`) and persist to `localStorage` under the key
`ytnt.settings`. `setSetting()` writes the new value, persists it, applies side
effects (theme attribute, window decorations, Phoneme path), and then calls
`this.requestUpdate()` by hand — the one place we ask for a render explicitly
because the backing field isn't reactive. See
[settings_reference.md](../user-guide/settings_reference.md) for the user-facing
list and [data_model_and_migrations.md](./data_model_and_migrations.md) for the
full `localStorage` key inventory.

### Lifecycle

| Hook | What it does |
| --- | --- |
| `connectedCallback()` | Registers global `keydown` + `focusin` listeners (capture phase) |
| `firstUpdated()` | Builds the `Player` over `#player`, wires its callbacks, starts the Phoneme probe timer + Google status check |
| `updated()` | Reflects `sidebarOpen` / `listOpen` onto the `collapsed` / `nolist` host attributes |
| `disconnectedCallback()` | Tears down listeners, the probe timer, and the Phoneme SSE bridge |

`firstUpdated()` is where the imperative world gets attached. The player needs a
real DOM node, so it can't be constructed until the shadow root exists:

```ts
firstUpdated() {
  this.refreshVideos();
  const el = this.renderRoot.querySelector("#player") as HTMLElement;
  this.player = new Player(el);
  this.player.onTick = (t, d) => this.onTick(t, d);
  …
}
```

### `render()` and the shadow DOM

`render()` returns one `html` template literal. It is **pure**: it reads state
and derives view-model values at the top (filtered/sorted video list, tag list,
filter counts) and emits markup — it must not mutate state. Event handlers are
inline arrow functions bound to component methods (`@click=${() =>
this.toggleSidebar()}`), and `?attr` / `.prop` bindings follow Lit's normal
syntax.

Because it's a web component, styles and markup are **encapsulated in the shadow
root**. That has two consequences worth internalizing:

- The `static styles` block (see below) is fully scoped — class names like
  `.libcard` can't leak out or be overridden from outside.
- DOM lookups go through `this.renderRoot`, **not** `document`. You'll see
  `this.renderRoot.querySelector("#editor textarea")` after an `updateComplete`
  await whenever the code needs to focus a freshly rendered input. `document` is
  used only for genuinely global concerns (`document.fullscreenElement`,
  `document.documentElement.dataset.theme`).

Two small icon/SVG conventions live at the top of the file: the `I` object is a
map of inline `svg` template fragments (reused everywhere as `${I.search}`,
`${I.gear}`, …), and `THEMES` / `LIGHT_THEMES` drive the theme picker.

### The 3-pane grid and the `:host` variants

The layout is a single CSS grid on `:host`: **filters sidebar | video list |
detail**, with a title/app-bar row on top.

```css
:host {
  display: grid;
  grid-template-columns: 220px 340px 1fr;
  grid-template-rows: 44px minmax(0, 1fr);
  height: 100vh;
}
```

Collapsing a pane is done entirely in CSS by toggling **host attributes** — no
conditional rendering of the panes themselves. `updated()` reflects two booleans
onto the host, and the stylesheet redefines the grid columns per attribute:

```css
:host([collapsed])          { grid-template-columns: 0 340px 1fr; } /* sidebar hidden */
:host([nolist])             { grid-template-columns: 220px 0 1fr; } /* list hidden   */
:host([collapsed][nolist])  { grid-template-columns: 0 0 1fr; }     /* video only    */
```

The reflection happens here:

```ts
updated() {
  this.toggleAttribute("collapsed", !this.sidebarOpen);
  this.toggleAttribute("nolist", !this.listOpen);
}
```

`sidebarOpen` and `listOpen` are seeded from `localStorage` (`ytnt.sidebar` /
`ytnt.list`) so pane visibility survives restarts. `Ctrl/Cmd+B` toggles the
sidebar; `toggleFocus()` collapses both columns for a video-only view. The
user-facing behavior is documented in
[appearance_and_window.md](../user-guide/appearance_and_window.md).

### The `static styles` block

All CSS lives in one `static styles = css\`…\`` template at the bottom of the
component. Notes on how it's organized:

- **Colors come from CSS custom properties** (`--bg-deep`, `--fg-default`,
  `--accent`, `--ok`, `--err`, `--border-subtle`, …) defined per theme outside
  the component. The component only references the variables, so switching
  `document.documentElement.dataset.theme` re-skins everything for free. A few
  derived tokens are mixed locally with `color-mix()` (`--tint`, `--hover`).
- **Motion respects the OS.** `--ui-motion` / `--ui-motion-fast` are zeroed under
  `@media (prefers-reduced-motion: reduce)`.
- **Tag chips** read a `--tag-color` custom property that the component splices
  in per-element via `chipStyle()` / `dotColor()` (see §3 on `safeTagColor`).
- Grid sub-layouts (the tag swatch picker, the compare view, the shortcuts
  cheat-sheet) are their own small `display:grid` rules inside the same block.

Because the styles are scoped, there is exactly one place to look when a UI
element is mis-styled, and no global stylesheet to grep across.

### Keyboard handling and focus

A single capture-phase `keydown` listener (`onKey`) implements every shortcut —
modal escape, transport (space / `k` / `j` / `l` / arrows / digits for seek),
playback rate (`+` / `-`), note navigation, capture (`Alt+N`), search (`/`), and
the cheat sheet (`?`). It early-returns when the user is typing in an
`INPUT`/`TEXTAREA`/`SELECT` or a modal is open, so shortcuts never fire mid-edit.
The authoritative list is [keyboard_shortcuts.md](../user-guide/keyboard_shortcuts.md);
if you add a binding, update that doc too.

One subtlety: the **YouTube iframe steals focus on click**, which would kill our
shortcuts. `onFocusIn` blurs the iframe on the next frame so focus returns to the
app. This is safe because transport is driven through the player's JS API (§4),
not through the iframe's own keyboard handling — the iframe never needs to keep
focus.

Modals (search, settings, Tag Manager) use a small focus-trap (`trapTab`,
`focusables`, `openModal` / `closeModal`) that remembers and restores the trigger
element, and the non-modal panes are marked `?inert` while a modal is open.

---

## 2. `src/api.ts` — the IPC boundary

[`src/api.ts`](../../src/api.ts) is the **only** module that imports
`@tauri-apps/api/core`'s `invoke`. Everything the frontend asks of Rust goes
through the `api` object — a flat map of typed wrapper functions. Keeping
`invoke` quarantined here means the component never deals with raw command names
or untyped payloads, and the TypeScript interfaces at the top of the file
(`VideoWithCount`, `Note`, `SearchHit`, `Segment`, `PhonemeRec`, …) are the
shared shape of every backend payload.

```ts
export const api = {
  listVideos: () => invoke<VideoWithCount[]>("list_videos"),
  createNote: (videoId: string, tSecs: number, content: string) =>
    invoke<Note>("create_note", { videoId, tSecs, content }),
  …
};
```

### The camelCase → snake_case mapping

This is the one rule that trips people up. **Tauri automatically converts
camelCase JS argument keys to snake_case Rust parameter names.** So the wrapper
passes `{ videoId, tSecs }` and the Rust command receives `video_id: String,
t_secs: f64`. There is a comment to this effect right above the `api` object.

Practical consequences when adding a command:

- The **command name** (the first `invoke` argument) is the literal snake_case
  string and must match the Rust `#[tauri::command]` function name exactly —
  e.g. `"set_video_title"`.
- The **argument object keys** are camelCase in JS; Tauri snake-cases them to
  match the Rust parameter names. Write `{ extRef }` for a Rust `ext_ref`
  parameter, not `{ ext_ref }`.
- The **return type** is the `invoke<T>()` type parameter and must match what the
  Rust command serializes.

A few wrappers also normalize optionals on the JS side before the call, e.g.
`youtubeCaptions` sends `{ videoId, lang: lang ?? null }` so the Rust side always
sees an explicit `null`.

For the receiving end of each command — the handler signatures, the registry,
and serialization — see [backend_guide.md](./backend_guide.md). The
Phoneme/Google command families are covered in
[integrations.md](./integrations.md).

---

## 3. `src/lib.ts` — pure helpers (and their tests)

[`src/lib.ts`](../../src/lib.ts) holds the **side-effect-free** logic: no DOM, no
`invoke`, no `localStorage`. That's deliberate — pure functions are trivially
unit-tested, and [`src/lib.test.ts`](../../src/lib.test.ts) covers every one of
them with Vitest. Run them with `npm test` (see
[testing_and_verification.md](./testing_and_verification.md)).

| Helper | What it does |
| --- | --- |
| `parseVideoId` | Extracts an 11-char id from a bare id or any common YouTube URL shape (`watch`, `youtu.be`, `shorts`, `embed`, `live`); `null` if not YouTube |
| `parsePlaylistId` | Pulls the `list=` id from playlist / watch URLs |
| `parseRef` / `serializeRef` | Read/write `videos.ext_ref` JSON (`{"integration":"phoneme","ref":"…"}`); `parseRef` tolerates the legacy bare-string form |
| `formatTime` | Seconds → `m:ss` / `h:mm:ss` |
| `applyOffset` | Rewinds a capture timestamp by the configured offset, clamped at 0 |
| `tsLink` | Builds a `youtu.be/<id>?t=<secs>` deep link |
| `notesToMarkdown` | Renders one video's notes to Markdown, sorted by time, with clickable timestamp links |
| `formatViews` | Compact view count (`1.5K views`, `2M views`) with pluralization |
| `relativeDate` | Coarse "3 years ago" from an ISO string (`now` is injectable so it's testable) |
| `safeTagColor` | Whitelists a validated `#hex` (else falls back) — it's spliced into inline `style`, so this guards against injection |
| `tagInk` | Picks black or white text ink for a tag color by YIQ luma |
| `mergeTagSets` | The 3-way set merge behind bidirectional tag sync |
| `DEFAULT_TAG_COLOR` | Phoneme's default tag color (`#cba6f7`), so new tags match |

`mergeTagSets` is the most load-bearing of these — it's the algorithm behind
Phoneme tag sync. Given `base` (last-synced tag set, `null` if never synced),
`local`, and `remote`, it returns `{ merged, toAttach, toDetach }`: the union to
keep, the tags to push to Phoneme, and the tags to detach. First sync (no base)
is a union that never deletes; afterward, "added" means not-in-base and "removed"
means in-base, so a tag can't be both and the merge is conflict-free.
`src/lib.test.ts` exercises every branch (local add, local remove, remote add,
remote remove, simultaneous changes, case-insensitive matching). The orchestration
that *calls* it — the per-video base snapshot in `localStorage` (`ytnt.tagSyncBase`),
the pending queue, and the reconcile flow — lives in `app.ts`
(`reconcileVideoTags`, `flushPendingTags`, `syncAllTags`) and is described in
[integrations.md](./integrations.md). User-facing behavior:
[tags.md](../user-guide/tags.md).

**Keep `lib.ts` pure.** If a helper needs the DOM, `invoke`, or storage, it
belongs in `app.ts`, not here — the test file assumes everything in `lib.ts`
runs in a bare module with no browser globals.

---

## 4. `src/player.ts` — the YouTube wrapper

[`src/player.ts`](../../src/player.ts) is a thin class over the **YouTube IFrame
Player API**. It loads the API script once (`https://www.youtube.com/iframe_api`,
guarded so it injects only one `<script>`), resolves a promise when
`onYouTubeIframeAPIReady` fires, and exposes a small imperative surface the
component drives: `seekTo`, `play`, `pause`, `toggle`, `seekBy`, `setRate` /
`getRate`, `toggleMute`.

### cue vs. load

This is the key design choice. The **first** video constructs a
`new YT.Player(...)`; **every subsequent** video reuses the same player and calls
`cueVideoById` rather than `loadVideoById`:

```ts
async load(videoId: string, startSeconds = 0) {
  await this.apiReady();
  if (!this.yt) {
    this.yt = new window.YT.Player(this.el, { videoId, playerVars: { … }, events: { … } });
  } else {
    // cue (not load) so switching videos doesn't auto-play — it sits at the
    // resume point until the user hits play.
    this.yt.cueVideoById({ videoId, startSeconds });
  }
}
```

**Why `cue`:** `cueVideoById` loads the video and parks it at `startSeconds`
without auto-playing, which is exactly the resume-position behavior we want —
open a video and it waits for you at where you left off. `loadVideoById` would
auto-play. The resume point comes from `videos.last_pos_secs`, written back by
`onTick`.

### `playerVars`

```ts
playerVars: {
  enablejsapi: 1, playsinline: 1, rel: 0, fs: 0,
  origin: location.origin, start: Math.floor(startSeconds),
}
```

- `enablejsapi: 1` — lets us drive the player from JS (the whole point of this
  wrapper).
- `fs: 0` — **hides YouTube's own fullscreen button on purpose**, so our `f`
  shortcut fullscreens `#playerWrap` instead and the `Alt+N` note overlay can
  render on top of the fullscreened video.
- `rel: 0`, `playsinline: 1`, `origin` — restrict related videos, allow inline
  playback, and pin the embed origin.

### The tick loop

`currentTime` and `duration` are **plain fields, not reactive state** — the
header comment in the file calls `currentTime` "the ref". A 250ms `setInterval`
(`startPoll`) polls the API ~4×/s and fires `onTick(t, d)`. The component's
`onTick` updates the progress bar by writing inline style directly (not via a
render), bumps `this.dur` only when it actually changes, and throttles the
resume-position save to once every ~3s. Polling the time through reactive state
would re-render the whole component four times a second — keeping it a plain
field is what makes the loop cheap. `onTitle` (from `onStateChange`) backfills a
video's title the first time it loads.

User-facing playback/notes behavior: [taking_notes.md](../user-guide/taking_notes.md).

---

## 5. How to add UI

Most additions follow one of these shapes.

**Add a new piece of view state**

1. Add an `@state() private` field with a sensible default.
2. Read it in `render()` and emit markup; bind events to a new private method.
3. Mutate it by reassignment in that method — Lit re-renders automatically. (Only
   reach for `this.requestUpdate()` if the value lives on a non-reactive field
   like `this.settings`.)

**Add a backend call**

1. Add (or reuse) a Rust `#[tauri::command]` — see
   [backend_guide.md](./backend_guide.md).
2. Add a typed wrapper to the `api` object in [`src/api.ts`](../../src/api.ts):
   the snake_case command name, camelCase argument keys (Tauri snake-cases them),
   and the `invoke<T>()` return type. Add/extend the payload interface if needed.
3. Call `api.yourCommand(...)` from a component method, then refresh the relevant
   state (`refreshVideos()`, `refreshNotes()`, …).

**Add a pure helper**

Put it in [`src/lib.ts`](../../src/lib.ts) only if it has no DOM / `invoke` /
storage dependency, and add a case to [`src/lib.test.ts`](../../src/lib.test.ts).
Anything impure stays in `app.ts`.

**Add a shortcut**

Extend `onKey` in `app.ts` (mind the typing/modal early-returns), and document it
in [keyboard_shortcuts.md](../user-guide/keyboard_shortcuts.md).

**Add a setting**

Add the field to the `Settings` interface and the `def` object in
`loadSettings()`, render a control wired to `setSetting("yourKey", value)`, and —
if it has a side effect (theme, window, backend path) — handle that key inside
`setSetting`. Document it in
[settings_reference.md](../user-guide/settings_reference.md).

**Style it**

Add rules to the `static styles` block using the existing CSS custom properties
so every theme picks them up. Don't hard-code colors — use `--fg-default`,
`--accent`, `--bg-surface`, and friends.

### Verify before you commit

```powershell
npm run type-check   # tsc --noEmit
npm test             # vitest (covers src/lib.ts)
npm run tauri dev    # Vite dev server on port 5191 (strictPort)
```

Full pre-PR checklist (including the Rust gates): see
[testing_and_verification.md](./testing_and_verification.md). To run the app from
source, see [building_from_source.md](./building_from_source.md). For where new
work fits in the overall design, start at [architecture.md](./architecture.md).
