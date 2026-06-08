# Mac Mini server — infra backup branch

This branch is **not** for deployment. It's an off-machine backup of the
infrastructure that runs only on the home Mac Mini M4 (unattended server),
which is otherwise untracked on `main` (the deployed Next.js web app).

## What's here (in addition to the web app from `main`)
- `scripts/run-reddit-hourly.sh` — launchd wrapper (lock + cooldown + wait-net + fetch→summarize).
- `scripts/fetch-reddit-to-db.mjs` — scrape r/halifax → Supabase `reddit_posts`.
- `scripts/summarize-reddit-mac-mini.mjs` — Gemini summaries + edge-tts → `reddit_post_summaries` (ranks rows by Reddit "hot").
- `deploy/com.karlfi.reddit-hourly.plist` — the LaunchAgent (`~/Library/LaunchAgents/`).
- `docs/reddit-hourly-job.md` — full ops doc: run logic, 3-layer power-outage recovery, testing, commands, history.

## Secrets
Not included. Live job reads them from `.briefing.env` / `.gemini-session.json`
(gitignored on `main`). Restore those out-of-band on the machine.

## Restore
`git checkout mac-mini-server -- scripts/run-reddit-hourly.sh scripts/fetch-reddit-to-db.mjs scripts/summarize-reddit-mac-mini.mjs deploy docs/reddit-hourly-job.md`
then put the plist back in `~/Library/LaunchAgents/` and `launchctl load` it.
