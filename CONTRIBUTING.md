# Contributing

Thanks for your interest in the Halifax Civic Dashboard. This is a small
non-commercial side project — contributions, bug reports, and suggestions
are welcome.

## Quick start

```bash
git clone https://github.com/<your-fork>/halifax-civic-dashboard.git
cd halifax-civic-dashboard
npm install
npm run dev          # http://localhost:3000
```

No environment variables required for local dev. Reddit data is read from
the committed `public/reddit.json` (updated by CI), so you'll see whatever
was last pulled.

Before opening a PR:

```bash
npm run lint
npm run build        # catches type errors and RSC mistakes
```

## Project conventions

### Architecture

- **Single RSC entry**: [app/page.tsx](app/page.tsx) fetches everything
  server-side in parallel. Don't add per-tab routes unless you have a
  strong reason — the swipeable single-page model is the product.
- **One fetcher per data source**, in `lib/fetchers/`. Each must return
  an "empty" sentinel on failure (never throw to the page).
- **Wrap every fetcher call** in `safe()` at the page level so one broken
  upstream can't 500 the dashboard.
- **One screen component per tab**, in `components/screens/`. Keep them
  presentational — data shaping belongs in the fetcher.

### When the upstream is flaky or hostile

If a data source rate-limits, blocks data-center IPs, or is otherwise
unreliable at request time, prefer the **cron → static JSON** pattern
used for Reddit:

1. Write a fetch script in `scripts/`.
2. Schedule it via `.github/workflows/`.
3. Commit the output JSON to `public/`.
4. Read it as a static asset from the page.

This gives the dashboard a "last known good" fallback for free.

### Webcams and other polled assets

- Use [`usePolledImage`](components/usePolledImage.ts) for any polled
  image. It already pauses on `visibilitychange`.
- Default refresh interval is 10 s. Don't go lower without a reason —
  mobile users pay for every frame.

### Image hosts

If you add a new image source, allowlist it in
[`next.config.ts`](next.config.ts) under `images.remotePatterns`. If
Chrome's Opaque Response Blocking drops it, proxy it through
[`app/api/img/route.ts`](app/api/img/route.ts) and add the hostname to
that file's allowlist as well.

### Iteration safety

- Every PR gets a Vercel **Preview Deployment** — open it on a real phone
  before merging.
- For risky changes, gate the new behaviour behind an env var
  (`NEXT_PUBLIC_ENABLE_*`) so you can flip it off in production without a
  redeploy.
- Wrap new screens in a React Error Boundary so client-side errors don't
  blank the whole dashboard.
- If a deploy goes bad, use Vercel Dashboard → Deployments → "Promote to
  Production" on the last good build for instant rollback.

## Code style

- TypeScript strict mode. No `any` without a comment explaining why.
- Tailwind for styling; avoid one-off CSS files.
- Prefer Server Components. Mark Client Components with `"use client"`
  only when you need state, effects, or browser APIs.
- Comments should explain **why**, not what. The existing fetchers and
  the image proxy are good examples.

## Reporting bugs

Open a GitHub issue with:

- What you saw
- What you expected
- Browser / device (especially if mobile)
- A screenshot if it's visual

Data-source breakages (a scraped page changed its HTML, a feed disappeared)
are the most common issue — those are good first contributions to fix.

## Scope

The dashboard is intentionally **read-only** and **Halifax-only**. PRs
that add user accounts, write actions, monetization, or expand beyond
HRM are likely to be declined. Suggestions for new Halifax-area data
sources are very welcome.
