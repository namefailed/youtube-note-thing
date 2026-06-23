# Planning docs

Pre-development design for **youtube-note-thing**. The user-facing overview lives in the
[root README](../README.md); these are the build-time design docs.

Read in this order:

1. **[COMPETITORS.md](COMPETITORS.md)** — the landscape, what each tool does, and where this app fits.
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — system shape, data model, the integration seam, constraints, error handling.
3. **[UX.md](UX.md)** — the note-capture experience: layout, the keyboard-first flow, accessibility.
4. **[INTEGRATIONS.md](INTEGRATIONS.md)** — the pluggable integration interface, the built-in Markdown/Obsidian export, and the Phoneme adapter (grounded in Phoneme's real CLI + REST).
5. **[ROADMAP.md](ROADMAP.md)** — phased build plan, standalone-first.
6. **[TESTING_STRATEGY.md](TESTING_STRATEGY.md)** — what gets tested and how.
7. **[ADR-001-template.md](ADR-001-template.md)** — template for recording architecture decisions.

## Design principles

- **Standalone first.** Every core feature works with zero integrations installed.
- **Don't rebuild what exists.** Transcription, semantic search, RAG, and PKM export already exist in
  Phoneme and elsewhere — connect to them instead of reimplementing fragile pipelines.
- **One seam for integrations.** Adding Notion or another transcription backend must not touch the core.
- **Local-first, you own the data.** One SQLite file. No account. No telemetry.
- **Honest scope.** No ad-blocking, no downloading, no cross-origin screenshots. Say so plainly.
