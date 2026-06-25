## What & why

Briefly: what does this change, and why?

## How it was verified

- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `cargo check` (and `cargo test` if backend changed) passes in `src-tauri/`
- [ ] Tried it in the running app (`npm run tauri dev`) where applicable

## Notes for reviewers

Anything worth calling out — trade-offs, follow-ups, or areas needing a closer look.

> Schema change? Add a **new** migration file — never edit a committed one
> (`src-tauri/migrations/` are checksummed and immutable). See the data-model docs.
