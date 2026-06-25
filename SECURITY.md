# Security

youtube-note-thing is local-first. Your library, notes, and YouTube/Phoneme
credentials live on your machine — nothing is sent anywhere except directly to
the services you connect (YouTube's API when you link a Google account, and your
local Phoneme install when you use it). There is no telemetry.

## Where sensitive data lives

- **Google OAuth tokens** are stored in the app's local data directory after you
  connect an account, and are removed when you disconnect.
- **The bundled Google client** (optional, compiled in from a gitignored `.env`
  via `build.rs`) follows Google's *installed-app* model. As with any desktop
  OAuth client, the client secret embedded in a distributed binary is not a true
  secret — it cannot be used to impersonate the app without a user completing the
  consent flow on their own machine. You can always supply your own client
  instead (see the YouTube account guide).
- **No real secrets are committed.** Only `.env.example` (empty placeholders) is
  tracked; `.env`, `.keys/`, and the database are gitignored.

## Reporting a vulnerability

Please report security issues **privately** rather than opening a public issue:
use GitHub's **Report a vulnerability** button under the repository's *Security*
tab (Private vulnerability reporting). Include steps to reproduce and the
affected version/commit. You'll get a response as soon as reasonably possible.
