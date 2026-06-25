# 🏗️ Building youtube-note-thing from source

Welcome. If you want to hack on **ytnt** or just compile it yourself, you're in the right place.

The backend is **Rust**, the frontend is **TypeScript** (Vite + a single [Lit](https://lit.dev/) web component), and the desktop wrapper is **Tauri v2**. Storage is **SQLite** via `sqlx`. Windows is the primary target (the player runs in WebView2), but the same tree builds on macOS and Linux.

This page covers prerequisites, the dev loop, and the production build. For what the code *does* once it's running, read the [Architecture](architecture.md) overview first, then the [Frontend guide](frontend_guide.md) and [Backend guide](backend_guide.md). To verify a change before you push, see [Testing & verification](testing_and_verification.md). To contribute it back, see [Contributing](../../CONTRIBUTING.md).

> **All commands below are PowerShell** — ytnt is Windows-first. They work unchanged in any POSIX shell except where a per-OS note says otherwise. Run everything from the **repository root** unless told otherwise.

---

## 📦 Prerequisites

| # | Toolchain | Why it's needed | Minimum |
| --- | --- | --- | --- |
| 1 | **Node.js** | Runs Vite (the frontend dev server and bundler) and the Tauri CLI wrapper. | 18+ |
| 2 | **Rust** (stable, via rustup) | Compiles the Tauri backend in `src-tauri/`. | latest stable |
| 3 | **Tauri v2 OS dependencies** | C/C++ build tools and the system WebView Tauri links against. | per-OS (below) |
| 4 | **WebView2** (Windows only) | The runtime the embedded YouTube player renders in. | Evergreen runtime |

### 1. 🟢 Node.js

Install **Node 18 or newer** from [nodejs.org](https://nodejs.org/) or via a version manager such as [nvm](https://github.com/nvm-sh/nvm) / [nvm-windows](https://github.com/coreybutler/nvm-windows). This brings `npm`, which drives every frontend and Tauri command in this repo.

### 2. 🦀 Rust

Install the Rust **stable** toolchain with [rustup](https://rustup.rs/). ytnt tracks current stable.

```powershell
# Windows (PowerShell): download and run the rustup installer
winget install Rustlang.Rustup
```

On macOS/Linux use the standard one-liner from [rustup.rs](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 3. 🖥️ Tauri v2 OS dependencies

Tauri needs a C/C++ toolchain and the platform's WebView libraries. Follow the official [Tauri v2 prerequisites](https://tauri.app/start/prerequisites/) for your OS — summarized:

- **Windows** — Install the [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (the "Desktop development with C++" workload). WebView2 is covered in step 4.
- **macOS** — `xcode-select --install`
- **Linux** — install `webkit2gtk` and the usual build dependencies, e.g. on Debian/Ubuntu:
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev librsvg2-dev
  ```

### 4. 🪟 WebView2 (Windows)

The app renders inside **WebView2**. The Evergreen runtime ships with Windows 11 and recent Windows 10 updates, so it's usually already present. If a build runs but the window is blank, install the [WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/) and try again.

---

## ⬇️ Get the code & install dependencies

Clone the repo and install the frontend dependencies once:

```powershell
git clone https://github.com/namefailed/youtube-note-thing.git
cd youtube-note-thing
npm install
```

`npm install` only pulls the JavaScript/TypeScript dependencies. The Rust crates in `src-tauri/` are fetched and compiled the first time you run a Tauri command below — the first compile takes a while; later builds are incremental.

---

## 🛠️ Development mode (hot reload)

```powershell
npm run tauri dev
```

That's the whole loop. Tauri's `beforeDevCommand` starts Vite for you (`npm run dev`), waits for it, then launches the native window pointed at it — you do **not** need a second terminal for Vite.

A few things to know:

- **Vite serves on port `5191`, with `strictPort` on.** The port is fixed on purpose: Phoneme's dev server uses `5173`, and you'll often run both at once, so ytnt was moved off it. Because `strictPort` is set, Vite **fails** rather than silently picking another port if `5191` is taken — free the port instead of letting it drift, or the Tauri window won't find the frontend. The dev URL is wired up in [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json) (`build.devUrl`) and [`vite.config.ts`](../../vite.config.ts).
- **Frontend edits hot-reload** through Vite. **Rust edits** (anything under `src-tauri/`) trigger a backend recompile and an app restart.
- Vite's watcher is told to ignore `src-tauri/**` so it doesn't fight the Rust build for file locks.

Editing only TypeScript/CSS? You can run the frontend by itself in a browser tab with `npm run dev`, but note that any `invoke()` call into the Rust backend only works inside the Tauri window — so the standalone Vite server is useful for pure-UI work, not for testing commands.

---

## 📦 Production build

```powershell
npm run tauri build
```

This runs `beforeBuildCommand` (`npm run build` → `vite build` into `../dist`), compiles the Rust backend in release mode, then bundles a platform installer.

**Artifacts** land under `src-tauri/target/release/`:

- the standalone binary `youtube-note-thing` (`.exe` on Windows), and
- the installer under `src-tauri/target/release/bundle/`.

The bundle is configured in [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json):

| Setting | Value |
| --- | --- |
| `bundle.targets` | `msi` (Windows installer) |
| `identifier` | `dev.ytnt.app` — also the folder name for app data (see [Data model & migrations](data_model_and_migrations.md)) |
| `bundle.createUpdaterArtifacts` | `true` — emits the updater payload + signature alongside the installer |

> The updater signs its artifacts with a private key kept in `.keys/` (gitignored — never commit it). You don't need it for a normal local build; it only matters when cutting a release that the in-app updater will accept.

To build a non-default target (e.g. on Linux/macOS), pass it through to the Tauri CLI:

```powershell
npm run tauri build -- --bundles deb     # example: a .deb on Linux
```

---

## 🔑 The bundled Google OAuth client (`.env`) — optional

ytnt can connect to a YouTube account so you can browse playlists, toggle videos in and out of your library, and pull video metadata (see [YouTube account & playlists](../user-guide/youtube_account_and_playlists.md)). That uses a Google **OAuth "Desktop app" client**.

There are two ways the running app gets a client:

1. **Compiled-in default.** [`src-tauri/build.rs`](../../src-tauri/build.rs) reads `YTNT_GOOGLE_CLIENT_ID` and `YTNT_GOOGLE_CLIENT_SECRET` at compile time and bakes them into the binary via `option_env!`, so a released build's "Connect YouTube" works out of the box. The values come from a **gitignored `.env`** at the repo root (or from process env, e.g. CI secrets — process env wins over the file). They are **never** read from committed source.
2. **User-supplied.** If no client was compiled in, the user can paste their own client ID and secret into the app's Settings (`gClientId` / `gClientSecret`). See the [Settings reference](../user-guide/settings_reference.md).

**This `.env` is entirely optional for building.** If you leave it blank (or omit it), the build succeeds — the compiled-in client is just empty, and YouTube features wait until the user adds their own client in Settings. Everything else in the app works without it.

To compile in your own default client, copy the example and fill it in:

```powershell
Copy-Item .env.example .env
# then edit .env and set YTNT_GOOGLE_CLIENT_ID / YTNT_GOOGLE_CLIENT_SECRET
```

```ini
# .env  (gitignored — never commit real secrets)
YTNT_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
YTNT_GOOGLE_CLIENT_SECRET=your-client-secret
```

The client must be a **Desktop app** OAuth client with the **YouTube Data API v3** enabled in its Google Cloud project. `build.rs` declares `cargo:rerun-if-changed=../.env` and `rerun-if-env-changed`, so editing `.env` (or the env vars) re-runs the build script on the next `cargo`/Tauri build — no manual clean needed.

> **A note on the secret.** Google treats Desktop-app client secrets as *non-confidential*: the OAuth flow is a loopback redirect, not a server exchange, so the secret can't be kept secret on a user's machine. ytnt only embeds it in the compiled binary — never in the JS bundle and never in the repo. For how the loopback flow itself works, see [Integrations](integrations.md).

---

## 🌍 Cross-platform notes

- **Windows is primary.** It's the only target in `bundle.targets` (`msi`) and the platform every contributor tests on first. WebView2 is the runtime; the C++ Build Tools are the compiler.
- **macOS / Linux** build from the same tree — install the matching Tauri OS dependencies (step 3) and pass an appropriate `--bundles` value to `tauri build` for native installers. These platforms aren't part of the default `msi`-only bundle config, so treat them as best-effort and verify the result.
- **Line endings.** `.gitattributes` pins `src-tauri/migrations/*.sql` to **LF** so `autocrlf` can't rewrite them. This is critical: `sqlx` checksums each migration by its exact bytes, and a flipped line ending makes an already-applied migration look modified, which breaks existing databases. If you touch migrations on any OS, never normalize their endings — see [Data model & migrations](data_model_and_migrations.md) for the full immutable-migration rule.

---

## 🧪 Before you commit

Run the same gates CI does:

```powershell
npm run type-check                # tsc --noEmit
npm test                          # vitest
cd src-tauri; cargo check; cargo test; cd ..
```

The full discipline — what each gate covers, how tests stay isolated, and the pre-PR checklist — lives in [Testing & verification](testing_and_verification.md).

---

## 🚑 Troubleshooting

**Error:** Vite exits immediately with a port-in-use message, or the Tauri window opens blank/"connection refused" in dev.
**Fix:** Port `5191` is taken and `strictPort` won't fall back. Free it (close the other process — often a stale `npm run tauri dev`) and re-run. The port is fixed by design to coexist with Phoneme on `5173`.

**Error:** `error: linker 'link.exe' not found` or a `cc`/C++ compiler error during the first Rust build.
**Fix:** The C/C++ build tools from prerequisite step 3 are missing. On Windows install the Microsoft C++ Build Tools ("Desktop development with C++"); on Linux/macOS install the platform build essentials.

**Error:** The app builds and launches but the window is blank.
**Fix:** WebView2 is missing or outdated (prerequisite step 4). Install the Evergreen WebView2 runtime and relaunch.

**Error:** Existing databases fail to open with `Migrate(VersionMismatch)` after you edited a file under `src-tauri/migrations/`.
**Fix:** Committed migrations are **immutable** — even a comment or line-ending change rewrites the checksum. Revert the edit and add a *new* migration file instead. See [Data model & migrations](data_model_and_migrations.md).

**"Connect YouTube" does nothing / says no client is configured.**
**This is expected** if you built without a `.env` and haven't added your own client. Either compile in a default client (see above) or add `gClientId` / `gClientSecret` in Settings. It is not a build failure.
