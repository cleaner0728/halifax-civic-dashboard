# Halifax Civic Dashboard

A read-only public dashboard for Halifax, Nova Scotia residents.  
Live at: [https://global-news-mvp.vercel.app](https://halifax-civic-dashboard.vercel.app/)

## What it does

Aggregates real-time local information into a single view:

- **Local News** — RSS feeds from CBC Nova Scotia and Halifax Examiner (past 24 hours)
- **HRM News** — Municipal announcements from Halifax Regional Municipality
- **HRFE Incidents** — Halifax Regional Fire & Emergency live incident feed (past 6 hours)
- **Transit Disruptions** — Active Halifax Transit detours and service alerts
- **Events Calendar** — Upcoming civic events from HRM Events Calendar
- **Weather** — Current conditions and 5-day forecast for Halifax, NS

## Reddit integration (pending API approval)

This app has applied for Reddit Data API access to display posts from r/halifax alongside the above civic data. The integration will:

- Fetch the top hot posts from r/halifax once every 15 minutes
- Display post title, flair, upvote count, comment count, and link back to Reddit
- Use Application-Only OAuth (client_credentials) — no user accounts accessed
- Make approximately 96 GET requests per day
- Cache results server-side for 15 minutes — no persistent storage of Reddit data

The goal is to surface community discussion alongside official civic information, driving traffic back to r/halifax for Halifax residents who may not regularly browse Reddit.

## Data sources

| Source | Type | Refresh |
|--------|------|---------|
| CBC Nova Scotia RSS | Public RSS | On demand |
| Halifax Examiner RSS | Public RSS | On demand |
| HRM News | Public RSS | On demand |
| HRFE Incident Feed | Public HTML scrape | On demand |
| Halifax Transit Disruptions | Public HTML scrape | On demand |
| HRM Events Calendar | Google Calendar embed | On demand |
| Open-Meteo | Public weather API | On demand |

## Tech stack

- Next.js 15 (App Router)
- TypeScript
- Deployed on Vercel

## Non-commercial

This project is non-commercial, open-source, and serves Halifax residents only. No user data is collected. No Reddit data is stored beyond a 15-minute server cache.
