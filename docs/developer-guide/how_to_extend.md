# How to extend ytnt

This page is a set of **copy-the-pattern recipes** for the changes you'll make most often: wiring a new backend command, adding a setting, evolving the schema, binding a key, and adding a sidebar filter. Each recipe walks the *whole* path — Rust, the typed bridge, and the UI — and points at the exact file and symbol that owns each step, because **the code is the source of truth**; the prose here only tells you where to put your hands.

If you haven't yet, read [architecture.md](architecture.md) first for the shape of the app, then [backend_guide.md](backend_guide.md) and [frontend_guide.md](frontend_guide.md) for the two halves you'll be editing. Schema work has its own deep dive in [data_model_and_migrations.md](data_model_and_migrations.md), and anything touching Phoneme or Google lives in [integrations.md](integrations.md). Before you open a PR, run the gates in [testing_and_verification.md](testing_and_verification.md).

The whole app is small on purpose: one Rust command module (`src-tauri/src/lib.rs`), one DB module (`src-tauri/src/db.rs`), one typed bridge (`src/api.ts`), one Lit component (`src/app.ts`), and pure helpers (`src/lib.ts`). Most features touch three or four of those and nothing else.

---

## 1. Add a Tauri command

A command is a Rust function the frontend calls by name. There are **four edits**, always in the same order, and skipping the third (registration) is the classic "command not found" bug.

### Step 1 — write the Rust function

Add it to [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs). Annotate with `#[tauri::command]`, return `Result<T, String>` so failures surface as a rejected promise, and convert any error with the local `err` helper. Commands that touch the database take `db: State<'_, Db>` and must be `async`:

```rust
#[tauri::command]
async fn set_video_note_color(db: State<'_, Db>, id: String, color: String) -> Result<(), String> {
    db.set_video_note_color(&id, &color).await.map_err(err)
}
```

Pure commands (no DB, no `await`) can be plain `fn` — see `save_markdown` for the shape. Put the actual SQL in a `Db` method in [`src-tauri/src/db.rs`](../../src-tauri/src/db.rs) rather than inline; that keeps `lib.rs` a thin command surface (the module's own doc comment says as much).

### Step 2 — register it in the handler

Add the function name to the `tauri::generate_handler![ … ]` list inside `run()` at the bottom of `lib.rs`. The macro only exposes names listed here:

```rust
.invoke_handler(tauri::generate_handler![
    list_videos,
    // …
    set_video_note_color,   // ← add it
])
```

### Step 3 — add the typed wrapper

Add a method to the `api` object in [`src/api.ts`](../../src/api.ts). The first argument to `invoke` is the **snake_case** command name; the payload object uses **camelCase** keys, which Tauri maps back to your snake_case Rust params automatically (this mapping is noted at the top of `api.ts`):

```ts
setVideoNoteColor: (id: string, color: string) =>
  invoke<void>("set_video_note_color", { id, color }),
```

If the command returns a struct, declare a matching `interface` in `api.ts` whose fields line up with the Rust type's serialized field names (see `VideoWithCount` ↔ `db::VideoWithCount`), and type the `invoke<…>` call with it. A command that returns a **new** struct must derive `serde::Serialize` on that Rust struct, or the value can't cross the bridge to the frontend.

### Step 4 — call it from the component

Import is already there (`import { api } from "./api"` in [`src/app.ts`](../../src/app.ts)). Call the wrapper, and follow the existing error pattern — surface failures with `this.flash(String(e), "err")`:

```ts
try {
  await api.setVideoNoteColor(this.currentId, color);
  await this.refreshVideos();
} catch (e) { this.flash(String(e), "err"); }
```

**Gotcha:** an `async` command that takes `State` must use the lifetime form `State<'_, Db>` — Tauri requires it for async handlers. **Verify with:** `cargo check` in `src-tauri/` (catches the Rust side) and `npm run type-check` (catches a wrapper/interface mismatch).

---

## 2. Add a setting

Settings live entirely on the frontend in `localStorage` under the key `ytnt.settings`; the backend never reads them (the one exception is the Phoneme CLI path, which is *pushed* to Rust on change — see below). There are **three edits**.

### Step 1 — extend the interface and the default

Both are in [`src/app.ts`](../../src/app.ts). Add your field to the `Settings` interface (around line 66) and give it a default in `loadSettings()` (the `def` object). `loadSettings` spreads the defaults under the stored JSON, so old saved settings that predate your field automatically inherit the default:

```ts
interface Settings { /* …existing… */ ; compactCards: boolean; }

// in loadSettings():
const def: Settings = { /* …existing… */, compactCards: false };
```

The current fields are `offset`, `autopause`, `vaultDir`, `theme`, `stripTitlebar`, `gClientId`, `gClientSecret`, `hiddenPlaylists`, `phonemeBin`, `syncTags` — match their style (primitives or string arrays).

### Step 2 — add the UI control

Add a `<label class="field">` inside the relevant `<section class="settings-section">` in the settings dialog render (the `Appearance` / `Capture` / `Storage & backup` / `Phoneme` / `YouTube account` sections, around line 1268+). Bind the control's change handler to `setSetting`:

```ts
<label class="field"><span>Compact library cards</span>
  <input type="checkbox" .checked=${this.settings.compactCards}
    @change=${(e: Event) => this.setSetting("compactCards", (e.target as HTMLInputElement).checked)} /></label>
```

### Step 3 — persistence is free

`setSetting<K extends keyof Settings>` (around line 668) immutably updates `this.settings`, writes the whole object back to `localStorage`, and calls `requestUpdate()`. You get persistence with no extra code. It's also where **side effects on change** go — `theme` updates `document.documentElement.dataset.theme`, `stripTitlebar` toggles window decorations, and `phonemeBin` calls `api.setPhonemeBin(...)` to push the path into the Rust `PHONEME_OVERRIDE`. If your setting needs an effect the instant it changes, add a branch there.

For the full catalogue of existing settings and what they do, see the user-facing [settings reference](../user-guide/settings_reference.md). Note that tag colors (`ytnt.tagColors`) and tag-sync snapshots (`ytnt.tagSyncBase`) are **separate** localStorage keys, not part of `Settings`.

---

## 3. Add a database column

Schema changes are **append-only**. You add a new migration file; you never edit a committed one.

> **Why never edit:** sqlx checksums each migration by its file bytes at startup. Changing even a comment or a line ending in an already-applied migration makes every existing database fail to open with `Migrate(VersionMismatch)`. `.gitattributes` marks `src-tauri/migrations/*.sql` as `-text` (git treats them as binary for line endings), so git never normalizes or converts their endings — the committed bytes, and therefore the sqlx checksums, stay stable. The full reasoning is in [data_model_and_migrations.md](data_model_and_migrations.md).

### Step 1 — add a migration file

Create the next numbered file in [`src-tauri/migrations/`](../../src-tauri/migrations) (the latest is `006_video_meta.sql`, so yours is `007_…`). Keep it additive — `ALTER TABLE … ADD COLUMN` with a default or nullable type, mirroring `004_pinned.sql` and `006_video_meta.sql`:

```sql
-- 007_video_rating.sql — optional 1–5 star rating per video.
ALTER TABLE videos ADD COLUMN rating INTEGER;
```

Migrations run automatically at startup via `sqlx::migrate!("./migrations")` in `run()` in `lib.rs`; there's no manual step.

### Step 2 — surface the column in a `FromRow` struct

In [`src-tauri/src/db.rs`](../../src-tauri/src/db.rs), add the field to whichever `#[derive(FromRow)]` struct the column should appear on — most reads of a video flow through `VideoWithCount`. Use `Option<i64>` for a nullable column:

```rust
pub struct VideoWithCount {
    // …existing fields…
    pub rating: Option<i64>,
}
```

These are **runtime** queries (the module doc note: not the compile-checked macros), so there's no `DATABASE_URL` build dependency — but it also means a struct field that isn't in the `SELECT` will fail at *run* time, not compile time. So:

### Step 3 — add the column to the relevant `SELECT` (and any writer)

Update `list_videos`'s query string in `db.rs` to select your new column (`#[derive(FromRow)]` matches columns to fields by **name**, so the `SELECT` must *include* a column for every struct field; column order doesn't matter). Then add a writer method + its command if the column is editable — e.g. follow `set_pinned` (a one-line `UPDATE`) plus its `#[tauri::command] set_pinned` in `lib.rs`, then expose it through `api.ts` as in [recipe 1](#1-add-a-tauri-command). If the value comes from YouTube metadata, extend `set_video_meta` and its `COALESCE` block instead.

### Step 4 — mirror it on the frontend type

Add the field to the matching interface in [`src/api.ts`](../../src/api.ts) (`VideoWithCount`), so the UI can read it.

**Verify with:** delete a throwaway dev DB (or test against a fresh one) so the migration actually applies, then `cargo test` / `cargo check` in `src-tauri/` and `npm run type-check`. **Once committed, the migration is immutable** — if you got the column wrong, fix it with *another* migration.

---

## 4. Add a keyboard shortcut

All global shortcuts are handled in one place: the `onKey` arrow function in [`src/app.ts`](../../src/app.ts) (around line 151), registered in `connectedCallback` as a capturing `keydown` listener on `window`.

### Step 1 — add a branch to `onKey`

Each shortcut is an early-return `if`. Order matters — the first match wins. The handler establishes a few guards you should respect:

- A `typing` check (`INPUT`/`TEXTAREA`/`SELECT` in the composed path) and an "any modal open" check bail out before player/note shortcuts, so typing in a field never triggers them. Put **global** shortcuts (that should work even while a modal is open or while typing) *above* that guard, like `Ctrl+B` and `Escape` already are; put **player/note** shortcuts below it.
- `if (!this.currentId) return;` gates the transport keys to "a video is loaded".
- Call `e.preventDefault()` when you're consuming the key, and `return` after handling.

```ts
// player must be loaded; below the typing guard:
if (k === "c") { e.preventDefault(); this.toggleCaptions(); return; }
```

### Step 2 — document it in the cheat sheet

Add a `[keys, description]` tuple to the `rows` array in `renderCheat()` (around line 1490) so it shows in the `?` overlay:

```ts
["C", "Toggle captions"],
```

The existing bindings (authoritative — read them in `onKey`, don't trust memory) include `Alt+N` capture, `Space`/`K` play-pause, `J`/`L` ±10s, `←`/`→` ±5s (Shift = 30s), `+`/`−` speed, `M` mute, `F` fullscreen, `Ctrl+B` sidebar, `0`–`9` seek to percent, `↑`/`↓` note selection, `Enter`/`Delete` edit/delete note, `/` search, `?` this sheet, `Esc` close. The user-facing list is in [keyboard shortcuts](../user-guide/keyboard_shortcuts.md) — update it too if the shortcut is user-visible.

**Gotcha:** the YouTube iframe steals focus on click; `onFocusIn` blurs it back so shortcuts keep firing. Transport keys drive the player through its JS API (in [`src/player.ts`](../../src/player.ts)) precisely so they work regardless of focus — prefer that path over anything that needs the iframe focused.

---

## 5. Add a sidebar filter

The left sidebar drives which videos the library list shows. Built-in views are tracked by one piece of state; tag and playlist filters are separate. There's **no backend involved** — filtering is pure client-side over the already-loaded `this.videos`.

### Step 1 — understand the existing state

In [`src/app.ts`](../../src/app.ts):

| State | Type | Meaning |
| --- | --- | --- |
| `libView` | `"all" \| "transcript" \| "untagged" \| "tagged"` | the active built-in view (line ~85) |
| `tagFilter` | `string \| null` | active tag name, or none |
| `plFilter` | `GPlaylist \| null` | active playlist browse, or none |

These are mutually adjusted: picking a tag sets `libView = "all"` and clears `plFilter`; opening a playlist clears `tagFilter`. Keep that invariant so two filters never silently stack in confusing ways.

### Step 2 — apply the filter in `render()`

The filtering ladder lives at the top of `render()` (around line 930), building `vids` from `this.videos`:

```ts
if (this.libView === "transcript") vids = vids.filter((v) => v.ext_ref);
else if (this.libView === "untagged") vids = vids.filter((v) => v.tags.length === 0);
else if (this.libView === "tagged") vids = vids.filter((v) => v.tags.length > 0);
if (this.tagFilter) vids = vids.filter((v) => v.tags.includes(this.tagFilter!));
```

To add a built-in view (say, "Pinned"), widen the `libView` union type, compute its count near the other counts (`transcriptCount`, `untaggedCount`, `taggedCount`), and add a branch here: `else if (this.libView === "pinned") vids = vids.filter((v) => v.pinned);`.

### Step 3 — add the sidebar button

Add a `<button class="sidebar-item …">` in the `<aside>` render (the `Library` / `Tags` sections, around line 959+), matching the existing rows: an `on` class when active, an icon span, a label, and a `<span class="count">`. Its click handler sets your view and clears the other filters, exactly like the existing items:

```ts
<button class="sidebar-item ${this.libView === "pinned" ? "on" : ""}"
  @click=${() => { this.libView = "pinned"; this.tagFilter = null; this.plFilter = null; }}>
  <span class="si-icon">${I.film}</span><span class="si-label">Pinned</span>
  <span class="count">${this.videos.filter((v) => v.pinned).length}</span>
</button>
```

Because `libView`, `tagFilter`, and `plFilter` are reactive `@state()`, assigning to them re-renders automatically — no manual refresh.

For how filters behave from a user's seat, see [library and filters](../user-guide/library_and_filters.md) and [tags](../user-guide/tags.md).

---

## Before you open a PR

Run the gates locally — they match what CI checks:

```powershell
npm run type-check        # tsc --noEmit
npm test                  # vitest
cd src-tauri
cargo check
cargo test
```

See [testing_and_verification.md](testing_and_verification.md) for the full checklist and [building_from_source.md](building_from_source.md) for `npm run tauri dev`. Contribution conventions are in [CONTRIBUTING.md](../../CONTRIBUTING.md).
