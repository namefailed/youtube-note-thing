# Contributing to youtube-note-thing

Thanks for wanting to hack on **ytnt**. This guide covers the architecture at a glance, how to get the app running locally, the checks every change must pass, and the conventions that keep the codebase coherent.

---

## 🏗️ Architecture

> For the full internals — process model, OAuth loopback flow, tag-sync merge — read [`docs/developer-guide/architecture.md`](docs/developer-guide/architecture.md).

ytnt is a **Tauri v2** desktop app: a Rust backend exposing commands over IPC, and a single web-component frontend.

1. **`src-tauri/src/lib.rs`** — the Rust app: every `#[tauri::command]`, the SQLite connection, Google OAuth (loopback `TcpListener`), and the Phoneme bridge. This is where backend work happens.
2. **`src-tauri/src/db.rs`** — database helpers and query plumbing layered over **sqlx** + **SQLite**.
3. **`src-tauri/src/main.rs`** — the thin binary entry point that hands off to `ytnt_lib`.
4. **`src-tauri/migrations/`** — versioned schema migrations (`001_init` … `006_video_meta`), applied at startup by `sqlx::migrate!("./migrations")`.
5. **`src/app.ts`** — the **entire UI**, one Lit 3 web component. New screens and interactions go here, not in a sprawl of components.
6. **`src/api.ts`** — typed wrappers around Tauri `invoke` calls; the only place the frontend talks to Rust.
7. **`src/lib.ts`** — pure helpers (formatting, the `mergeTagSets` 3-way merge). Pure functions live here and get unit-tested in `src/lib.test.ts`.
8. **`src/player.ts`** — the YouTube IFrame Player wrapper.

> Frontend deep-dive: [`docs/developer-guide/frontend_guide.md`](docs/developer-guide/frontend_guide.md). Backend deep-dive: [`docs/developer-guide/backend_guide.md`](docs/developer-guide/backend_guide.md).

### Adding a backend command

The frontend can only call Rust through registered commands, so to add one you must:

1. Write the function in `src-tauri/src/lib.rs` and annotate it `#[tauri::command]`.
2. Register it in the `tauri::generate_handler![ … ]` list in the same file.
3. Add a typed wrapper in `src/api.ts` so the UI calls it through one place.

---

## 🛠️ Development Environment Setup

### Prerequisites

- **Node.js** — LTS or newer (the app builds with **Vite 5** / **TypeScript 5.4**).
- **Rust toolchain** — stable, via `rustup`.
- **Tauri v2 system prerequisites** — on **Windows** (the primary platform) that means the **WebView2** runtime and the Microsoft C++ Build Tools. See the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) for your OS.

> Full walkthrough, including platform packages: [`docs/developer-guide/building_from_source.md`](docs/developer-guide/building_from_source.md).

### Running the App Locally

```powershell
# 1. Clone and install JS dependencies
git clone <your-fork-url> youtube-note-thing
cd youtube-note-thing
npm install

# 2. (Optional) Compile in the built-in Google OAuth client.
#    Copy .env.example to .env and fill in your "Desktop app" client.
#    Leave it blank to require users to add their own in Settings.
copy .env.example .env

# 3. Run in dev — launches the Vite dev server (port 5191, strictPort) and the Tauri shell
npm run tauri dev
```

The dev server is pinned to **port 5191 on purpose** — Phoneme's dev server uses 5173, and both can run at once.

### Running the Tests

```powershell
# Frontend
npm run type-check     # tsc --noEmit — type gate
npm test               # vitest run — unit tests (src/lib.test.ts)

# Backend (run from the src-tauri/ directory)
cd src-tauri
cargo check            # compiles the Rust crate without producing a binary
cargo test             # Rust unit tests
```

> More on what's covered and how to smoke-test: [`docs/developer-guide/testing_and_verification.md`](docs/developer-guide/testing_and_verification.md).

---

## ✅ Pre-PR Checklist

All three gates must pass before a change is mergeable:

```powershell
npm run type-check     # no type errors
npm test               # vitest green
cd src-tauri
cargo check            # Rust compiles
cargo test             # Rust tests green
cargo fmt              # format Rust changes before committing
cargo clippy           # lint Rust changes before committing
```

For features that touch the player, OAuth, or Phoneme, also do a manual smoke test per [`docs/developer-guide/testing_and_verification.md`](docs/developer-guide/testing_and_verification.md). The full doc map is the [documentation index](docs/README.md).

---

## 📐 Coding Conventions

- **Match the surrounding code.** Read the file you're editing and follow its style — naming, formatting, and structure should be indistinguishable from what's already there.
- **One frontend component.** The UI is a single Lit 3 web component in `src/app.ts`. Keep it that way; factor pure logic into `src/lib.ts` (and test it), and route all backend calls through `src/api.ts`.
- **Commands live in `lib.rs`.** All `#[tauri::command]` functions go in `src-tauri/src/lib.rs` and must be registered in the `generate_handler!` list.
- **Migrations are immutable — never edit a committed one.** `sqlx` checksums each migration by its exact file bytes. Changing a committed migration (even a comment, even a line ending) breaks every existing database with `Migrate(VersionMismatch)`. To change the schema, **add a new numbered migration** (e.g. `007_*.sql`). `.gitattributes` marks `src-tauri/migrations/*.sql` as `-text` (git treats them as binary for line endings), so git never normalizes or converts their endings — the committed bytes, and therefore the sqlx checksums, stay stable.

> Schema and migration details: [`docs/developer-guide/data_model_and_migrations.md`](docs/developer-guide/data_model_and_migrations.md). Extending the app step by step: [`docs/developer-guide/how_to_extend.md`](docs/developer-guide/how_to_extend.md). Phoneme and Google integrations: [`docs/developer-guide/integrations.md`](docs/developer-guide/integrations.md).

---

## 📤 Submitting Changes

1. **Fork** the repo and create a branch off the default branch (`master`).
2. **Write tests** for new pure logic (`src/lib.test.ts`) and Rust behavior where practical.
3. **Run the full checklist** above and make sure CI is green.
4. **Write imperative, conventional commit messages** — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. One concern per commit; describe the change, not the author.
5. **Open a pull request** against `master` with a clear description of what changed and why.

### No AI-tool attribution

Commit messages and PR bodies describe the change **only** — never who or what authored it. Do not add `Co-Authored-By` trailers, "generated with" lines, or any AI/assistant attribution of any kind.

---

## 🗒️ Scratch space

Gitignored drafts, throwaway scripts, and local notes go in the gitignored `scratch/` and `archive_internal/` paths — keep work-in-progress out of commits. Note `.env` is a separate, gitignored secrets file (it holds `YTNT_GOOGLE_CLIENT_ID`/`SECRET`), not a scratch directory. Never commit real secrets; `.env` stays out of git (CI uses repository secrets).

---

## 🤝 Code of Conduct

Be kind, assume good faith, and keep discussion focused on the work. See the [documentation index](docs/README.md) for everything else.
