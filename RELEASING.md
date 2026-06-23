# Releasing

A tagged push (`vX.Y.Z`) triggers [`.github/workflows/release.yml`](.github/workflows/release.yml),
which builds the Windows installer, signs the **updater** artifacts, and drafts a GitHub release with
`latest.json` so the in-app updater (Settings → Check for updates) can pull future versions.

## One-time setup

1. **Updater signing key.** A **dev** keypair was generated into `.keys/` (gitignored; `ytnt.key` private,
   `ytnt.key.pub` public) and its **public** key is in
   [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) under `plugins.updater.pubkey`. The dev key has an
   **empty password — test only.** For a real release, regenerate **with a password**
   (`npm run tauri signer generate -w <path>`, omit `--ci` so it prompts), update the pubkey field, and **keep
   the private key out of the repo** (password manager / OS keychain). Losing the key means installed clients can
   never verify updates (the pubkey is pinned), so back it up.
2. **GitHub repo secrets** (Settings → Secrets and variables → Actions):
   - `TAURI_SIGNING_PRIVATE_KEY` — the **contents** of the private key file.
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the key's password (**required** for a production key).
3. **Updater endpoint** — `plugins.updater.endpoints` points at
   `github.com/namefailed/youtube-note-thing/...`. Change the owner/repo if yours differs.

## Cut a release

1. Bump the version in `src-tauri/tauri.conf.json`, `package.json`, and `src-tauri/Cargo.toml` (keep them in sync).
2. Commit, then tag and push:
   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```
3. The workflow drafts a release. Review and publish it; the updater then sees `latest.json`.

## Code signing (optional, recommended for distribution)

The updater signature (above) lets the app verify updates, but it is **not** OS code signing — Windows
SmartScreen / macOS Gatekeeper still warn on unsigned binaries.

- **Windows (Authenticode):** obtain a code-signing certificate, then set
  `bundle.windows.certificateThumbprint` (or a `signCommand`) in `tauri.conf.json` and provide the cert to CI.
- **macOS (notarization):** build on a macOS runner and provide `APPLE_CERTIFICATE`,
  `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
  to `tauri-action`. (The current bundle targets `msi` only; add a runner matrix + `dmg`/`app` targets first.)

These require your own certificates/credentials, so they're left as documented steps rather than committed config.
