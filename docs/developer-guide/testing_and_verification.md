# Testing & verification

This is the page you read before opening a pull request. ytnt has a small,
fast test suite and a CI workflow that mirrors exactly what you can run
locally. The backend is **Rust** (`src-tauri/`), the frontend is **TypeScript**
(`src/`), and the wrapper is **Tauri** — so "the gates" means three toolchains,
not one. Run them all and you've reproduced CI.

There is no end-to-end harness and no mocked Tauri runtime: the unit tests cover
the **pure logic** (URL parsing, time/view formatting, tag merge, ISO-8601
durations), and everything that needs the real backend — IPC, the database,
the YouTube player — is verified by **running the app** (see
[Building from source](building_from_source.md)) or by inspecting the
backend-free **browser preview** described in section 4.

Related reading:

- [Building from source](building_from_source.md) — install the toolchains and run `npm run tauri dev`.
- [Backend guide](backend_guide.md) — the Rust command surface the integration tests live next to.
- [Frontend guide](frontend_guide.md) — the single Lit component and the `src/lib.ts` helpers under test.
- [Data model & migrations](data_model_and_migrations.md) — the migration-checksum gotcha that a green `cargo build` can still hide.
- [Integrations](integrations.md) — the Phoneme CLI/REST boundary that the tag-merge tests exercise on the ytnt side.
- [How to extend](how_to_extend.md) — where to add code (and therefore where to add tests).

---

## 1. The gates

CI runs on every push to `main`/`master` and every pull request
(`.github/workflows/ci.yml`). It is two jobs, and **local parity is exact** —
the commands below are the same ones CI runs.

| Gate | Command | Runs in | What it catches |
| --- | --- | --- | --- |
| Type check | `npm run type-check` | `frontend` (Ubuntu) | TypeScript errors (`tsc --noEmit`) |
| Frontend tests | `npm test` | `frontend` (Ubuntu) | Pure-helper regressions (Vitest) |
| Frontend build | `npm run build` | `frontend` (Ubuntu) | Vite build failures; also a prerequisite for the Rust build |
| Backend build | `cargo build --manifest-path src-tauri/Cargo.toml` | `rust` (Windows) | Rust compile + migration-checksum failures |

Two things worth knowing about the CI shape:

- **The `frontend` job runs on Ubuntu; the `rust` job runs on Windows.**
  Windows is ytnt's primary platform, and the Rust build is where the
  Windows-only bits live (the Phoneme daemon named pipe), so the backend is
  built where it ships.
- **`npm run build` runs before the Rust build on purpose.** `generate_context!`
  embeds `../dist` at compile time, so the Rust crate won't build until the
  frontend has been built once. If you skip the frontend build, `cargo build`
  fails with a missing-`dist` error rather than a Rust error.

### Run everything locally

All commands are PowerShell-first (Windows-primary project). Run from the repo
root:

```powershell
# Frontend gates (the `frontend` CI job)
npm install        # first time only; CI uses `npm ci`
npm run type-check
npm test
npm run build

# Backend gates (the `rust` CI job)
cd src-tauri
cargo test         # unit tests — CI only builds, but run the tests locally
cargo check        # fast compile check while iterating
cargo build        # full build, matching CI (needs ../dist from `npm run build`)
cd ..
```

> **Note:** CI's `rust` job only runs `cargo build`, not `cargo test` — the Rust
> unit tests are pure and have no I/O, so they're cheap. Run `cargo test`
> locally before a PR; it's the only place the backend's pure helpers are
> exercised.

### Pre-PR checklist

Copy-paste this block before opening a pull request:

```powershell
npm run type-check
npm test
npm run build
cargo test  --manifest-path src-tauri/Cargo.toml
cargo build --manifest-path src-tauri/Cargo.toml
```

If all five pass, both CI jobs will pass.

---

## 2. Frontend tests — `src/lib.test.ts`

There's **no Vitest config in the repo** — no `vitest.config.ts`, and no `test`
block in [`vite.config.ts`](../../vite.config.ts) — so Vitest runs on its
built-in defaults (it will read `vite.config.ts`, but nothing there configures
Vitest). `npm test` maps to `vitest run` (one-shot, non-watch). For a watch loop
while iterating, run `npx vitest`.

The single test file is [`src/lib.test.ts`](../../src/lib.test.ts), and it
covers exactly one module: the **pure helpers** in
[`src/lib.ts`](../../src/lib.ts). That file is deliberately side-effect-free
(no DOM, no `invoke`, no `window`), which is what makes it unit-testable without
a Tauri runtime. The single Lit component in `src/app.ts` is **not** unit-tested
— it's verified by running the app or the preview (section 4).

What the suite asserts, by `describe` block:

| Helper(s) under test | What's verified |
| --- | --- |
| `safeTagColor`, `tagInk` | Only a real hex passes; CSS-injection strings fall back to `var(--accent)`. `tagInk` picks dark ink (`#11111b`) on light tags and white (`#ffffff`) on dark, by YIQ luma; non-hex input returns `""`. |
| `formatViews` | Compacts counts with K/M/B and pluralizes (`1` → `1 view`, `1500` → `1.5K views`, `2_000_000` → `2M views`). |
| `relativeDate` | Buckets an ISO date into today / yesterday / N days / N months / N years against an **injected `now`**; unparseable input → `""`. |
| `mergeTagSets` | The bidirectional tag-sync 3-way merge: first sync unions and never deletes; local/remote add/remove each propagate; simultaneous changes both apply; case-insensitive matching keeps the remote casing. |
| `parsePlaylistId` | Pulls `list=` out of playlist and watch URLs; `null` when absent. |
| `parseVideoId` | Accepts bare ids and every common YouTube URL shape (`watch`, `youtu.be`, `shorts`, `embed`, `live`, with stray whitespace and `t=` params); rejects non-YouTube/junk. |
| `parseRef` / `serializeRef` | Round-trips the structured `ext_ref` form `{"integration":"phoneme","ref":"…"}` and reads a legacy bare recording id; `null` for empty/missing. |
| `formatTime` | `m:ss` / `h:mm:ss` boundaries; clamps negatives and `NaN` to `0:00`. |
| `applyOffset` | Rewinds by the capture offset but never goes negative. |
| `tsLink` | Builds a `youtu.be/<id>?t=<whole-second>` deep link (floors fractional seconds). |
| `notesToMarkdown` | Sorts notes by time and emits clickable `[m:ss](deep-link)` Markdown. |

Two patterns to notice and reuse when you add cases:

- **Time is injected, not read from the clock.** `relativeDate(iso, now)` takes
  `now` as a parameter so the test pins a fixed "today" (`2026-06-24`) and
  asserts exact bucket labels. Keep new time-dependent helpers injectable for
  the same reason.
- **Tag matching is case-insensitive but display-preserving.** The
  `mergeTagSets` cases assert that `["Lecture"]` and `["lecture"]` are the same
  tag and that the **remote (Phoneme) casing wins** in the merged result —
  Phoneme is the tag authority, and the test encodes that invariant.

---

## 3. Backend tests — `src-tauri/src/lib.rs`

The Rust unit tests live in the `#[cfg(test)] mod tests` block at the bottom of
[`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs), next to the free functions
they exercise. They are **pure parsers — no database, no process spawning, no
network** — so they run instantly and need no fixtures.

| Test | Function under test | What's verified |
| --- | --- | --- |
| `parses_iso8601_durations` | `parse_iso8601_duration` | YouTube ISO-8601 durations → whole seconds (`PT1H2M3S` → 3723, `P1DT2H` → 93 600, `PT0S` → 0); garbage → `None`. |
| `parses_phoneme_version_line` | `parse_phoneme_version` | Pulls major/minor out of a `phoneme X.Y.Z` line (and a bare `1.10.0`); non-numeric (`phoneme dev`, empty) → `None`. |
| `min_version_gate` | `parse_phoneme_version` + `MIN_PHONEME_VERSION` | The compatibility gate: anything `>= 1.8` passes, older fails, and an **unknown version is treated as compatible** so a quirky build never locks the user out. |
| `json_lines_parses_skips_and_flags_total_failure` | `parse_json_lines` | Mixed good/junk JSON-lines keeps the good lines; genuinely empty output is an empty `Vec` (OK — nothing transcribed yet); output that's present but **entirely unparseable** is an `Err` (a sign the Phoneme contract drifted). |

The reason these particular functions have tests and the bulk of `lib.rs`
doesn't: the rest of the file is `#[tauri::command]` handlers that shell out to
the Phoneme CLI, talk to the daemon pipe, or hit Google/YouTube over the
network — none of which is unit-testable without the live services. Parsing
their **output** is the part that can break silently on a version bump, so that's
the part under test. When you add a parser for a new CLI or API response, add a
case here following the same shape.

Run them:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

> **The migration gotcha a green build hides.** `cargo build`/`cargo test`
> compile against the *committed* migration files, but sqlx checksums each
> migration by its exact bytes, and a committed migration is **immutable** —
> editing one (even a comment or a line ending) breaks every existing dev DB at
> startup with `Migrate(VersionMismatch)`. Tests won't catch this because they
> don't open your real DB. To change schema, **add a new migration file**; never
> edit an old one. `.gitattributes` marks `src-tauri/migrations/*.sql` as `-text`
> (git treats them as binary for line endings), so git never normalizes or
> converts their endings — the committed bytes, and therefore the sqlx checksums,
> stay stable. See
> [Data model & migrations](data_model_and_migrations.md).

---

## 4. Manual & preview verification (the UI)

Everything not covered by the unit tests — the Lit component in `src/app.ts`,
the YouTube IFrame player (`src/player.ts`), the Tauri command surface, the
database, and the Phoneme/Google integrations — is verified by **running the
app**. There is no headless UI test runner.

There are two ways to run it, and they verify different things.

### 4a. Full app (the real backend)

```powershell
npm run tauri dev
```

This is the only mode that exercises the Rust backend: SQLite reads/writes,
`invoke` round-trips, OAuth, and the Phoneme CLI/REST/pipe paths. The Vite dev
server runs on **port 5191** (`strictPort`), chosen so it doesn't collide with
Phoneme's dev server. Use this to verify anything that touches data or an
integration. See [Building from source](building_from_source.md) for the
toolchain prerequisites.

### 4b. Browser preview (no backend)

You can load the frontend in a plain browser — `npm run dev` then open the Vite
URL, or the embedded preview — **without** the Tauri runtime. This is fast for
checking layout, themes, and computed styles, but **there is no backend**: the
app is built to render anyway rather than crash. The Tauri-only objects are
lazily resolved and guarded — e.g. `getCurrentWindow()` is wrapped so that
"outside the Tauri runtime (e.g. a browser preview) this is absent, and the app
must still render" (`src/app.ts`). In the preview:

- The window object is `null`, so titlebar/fullscreen controls degrade quietly.
- Every `api.*` call (which is `invoke(...)` under the hood — see
  [`src/api.ts`](../../src/api.ts)) **rejects**, so the video list, notes,
  search, and integration panels stay empty. That's expected, not a bug.

Because the preview has no data and no `invoke`, verify the UI by **injecting
state and inspecting computed styles** rather than by clicking through flows:

- **Inject state directly.** The app is a single Lit component with reactive
  `@state()` fields. Grab the element from the page and set its state (and call
  `requestUpdate()`) to render a list, a detail pane, or a tag chip without a
  backend — e.g. set the videos array to one hand-built `VideoWithCount`
  (shape in [`src/api.ts`](../../src/api.ts)) to check a library card's layout.
- **Inspect computed styles, not screenshots-as-truth.** The tag-color and
  contrast logic is the obvious thing to verify visually: read the computed
  `background`/`color` of a tag chip and confirm it matches what `safeTagColor`
  / `tagInk` produce for that hex. (The *math* is already locked down by the
  unit tests in section 2 — the preview check is that it's wired into the DOM
  correctly.)
- **Switch themes** by setting the document's theme attribute to any of the
  values in the `THEMES` list in `src/app.ts` and confirm the CSS variables flip.

The user-facing behaviors this verifies are documented in the user guide —
[Taking notes](../user-guide/taking_notes.md),
[Library & filters](../user-guide/library_and_filters.md), and
[Tags](../user-guide/tags.md) — and the integration-specific flows in
[Phoneme integration](../user-guide/phoneme_integration.md) and
[YouTube account & playlists](../user-guide/youtube_account_and_playlists.md).

---

## 5. How to add a test

### A frontend (pure-helper) test

1. If the logic isn't already a pure function, **move it into
   [`src/lib.ts`](../../src/lib.ts)** — the test file only imports from there,
   and keeping helpers free of DOM/`invoke`/`window` is what makes them
   testable. Export it.
2. Add it to the import list at the top of
   [`src/lib.test.ts`](../../src/lib.test.ts) and write a `describe`/`it` block.
   Match the existing style: assert boundaries and the junk/empty case, and
   **inject anything time- or environment-dependent** (as `relativeDate` does
   with `now`) so the test is deterministic.
3. Run `npm test` (or `npx vitest` to watch).

### A backend (parser) test

1. Keep the parser a **free function** that takes a `&str`/value and returns a
   `Result`/`Option` — don't bury parsing inside a `#[tauri::command]` that also
   does I/O, or it can't be tested.
2. Add a `#[test]` to the `mod tests` block at the bottom of
   [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs). Cover the happy path,
   the malformed input, and the **empty-vs-broken distinction** where it matters
   (as `json_lines_parses_skips_and_flags_total_failure` does — empty output is
   OK, all-unparseable output is an error).
3. Run `cargo test --manifest-path src-tauri/Cargo.toml`.

Then re-run the full [pre-PR checklist](#pre-pr-checklist) so you match CI before
pushing.
