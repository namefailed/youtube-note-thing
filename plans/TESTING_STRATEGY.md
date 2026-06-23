# Testing Strategy

Test the logic that breaks silently and costs data or trust. Skip the ceremony. This is a small app —
a handful of high-value tests beats a coverage number.

**Frameworks:** Vitest (frontend), `cargo test` (Rust). One Playwright smoke test for the capture loop.
No new test framework gets added without a reason.

## What actually needs a test

| Area | Why it's worth testing | Layer |
|------|------------------------|-------|
| Timestamp formatting | Off-by-one and the 3599→59:59 / 3600→1:00:00 boundary; `0`, negative, `NaN` | Vitest |
| Timestamp link gen | `youtu.be/ID?t=33` must be exact — it's the core promise | Vitest |
| URL → video-id parsing | `watch?v=`, `youtu.be/`, `shorts/`, with extra query params; reject non-YouTube | Vitest |
| FTS5 query sanitizing | Special chars and empty strings must not throw or return garbage | cargo test |
| Migration runner | Applies in order, idempotent on re-run, rolls back a failing migration | cargo test |
| Note CRUD + cascade | Deleting a video cascades its notes; FTS triggers stay in sync | cargo test |
| Markdown export format | Output matches the documented shape (it's a contract other tools parse) | cargo test |
| Integration `probe()` | Absent backend → reports absent, never throws, never blocks startup | cargo test |
| Integration dispatch | Unknown id / unsupported capability → clean error, not a panic | cargo test |

## What not to test

- Component render output, styling, animations — eyeball these.
- The YouTube IFrame API itself — it's Google's; test our wrapper's logic, not their player.
- A live Phoneme instance in CI — mock the REST responses; the contract is the JSON shape.

## The one E2E

Playwright (or Tauri's WebDriver): load a known video → press the capture key → assert a note appears
with the right timestamp → click it → assert `seekTo` fired. If that loop works, the product works.

## CI

GitHub Actions on every push/PR: `lint → typecheck → vitest → cargo test → build`. Build must pass on
Windows; macOS build is best-effort on a macOS runner. The E2E runs on a schedule, not every commit
(it's slower and flakier than it's worth gating on).

## Manual QA before a release

A short checklist, not a suite: invalid URL, private/deleted video, Error-153 video, offline launch,
DB-restore-from-backup, Phoneme present vs absent. See the error tiers in [ARCHITECTURE](ARCHITECTURE.md).
