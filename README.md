# Toledo VB

Password-protected stats dashboard for Toledo volleyball. Coaches upload
VolleyStation spreadsheets to the shared OneDrive folder; a scheduled sync
pulls them into this repo, normalizes them, and redeploys the site. Trends
for passer rating, setter/hitter connection, and hitting percentage —
individually and by set type.

## How data flows

```
OneDrive "Fall 2026/"  →  GitHub Actions (rclone, every 10 min in season)
  →  data/raw/          byte-for-byte mirror, full git history of every upload
  →  data/normalized/   canonical JSON written by scripts/ingest.ts
  →  push               Vercel deploys, site reflects the upload in ~10-15 min
```

Every rate on the site is recomputed from raw counts (`lib/metrics.ts`) —
cached spreadsheet cells are only used for the drift tests, and `#ERROR`
cells become blanks, never zeros. Rates under 10 attempts render greyed with
an attempts badge. Zero-attempt sessions are skipped in trend lines.

## Repo layout

| Path | What |
|---|---|
| `app/` | Next.js pages: Overview, Trends, Players, Connection, Set Types, Health |
| `lib/data.ts` | the only data access layer (swap point for a future Postgres) |
| `lib/metrics.ts` | every rate formula, rolling averages, MIN_ATTEMPTS |
| `packages/ingest/` | four format parsers + Zod schemas + tests with real fixtures |
| `scripts/ingest.ts` | CLI: `npm run ingest` (`--force`, `--check`, `--file <prefix>`) |
| `data/raw/` | OneDrive mirror (do not edit by hand — the sync overwrites) |
| `data/players.json` | roster seed with per-player alias list |
| `data/ingest-config.json` | season year + folder-to-session-kind rules |
| `.github/workflows/sync.yml` | the scheduled OneDrive sync |

## Development

```bash
npm install
cp .env.example .env.local   # set TEAM_PASSWORD
npm run dev                  # http://localhost:3000
npm test                     # parser + metrics suite (recompute gate)
npm run ingest -- --verbose  # re-parse data/raw into data/normalized
```

## One-time setup that still needs a human

1. **`RCLONE_CONFIG` repo secret** — the sync workflow fails loudly until
   this exists. On any machine with access to the shared folder:
   `rclone config` → new remote named `onedrive` (type onedrive), authorize,
   confirm `rclone lsd onedrive:` shows `Fall 2026`, then paste the entire
   `~/.config/rclone/rclone.conf` into a repository secret named
   `RCLONE_CONFIG`. When the token eventually expires (~90 days unused, or
   password/MFA change), run `rclone config reconnect onedrive:` and update
   the secret. The workflow's auth-canary step says exactly this when it
   fails.
2. **`TEAM_PASSWORD`** — set in Vercel project env vars. Changing it
   invalidates every login cookie (that's a feature). Share it only with
   the staff.
3. Manual sync anytime: Actions → "OneDrive sync" → Run workflow. There is
   also a `repository_dispatch` hook (event type `onedrive-sync`) wired for
   a future instant trigger from Power Automate or a folder watcher.

## Extending

- **Match season (Phase 4)**: the Matches folder parser path is already
  routed (`Matches/** → match`); confirm the export naming after the first
  real match and add opponent labels.
- **Postgres later**: IDs are deterministic strings and the schema in
  `packages/ingest/src/schema.ts` is already relational. Stand up the DB,
  copy the JSON, and swap `lib/data.ts` from file reads to queries — no
  page changes.
