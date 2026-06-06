// GET /api/reddit-briefing           → { items: [{slot,label,summary,postCount,createdAt,audio,...}] }
// GET /api/reddit-briefing?mode=text → same, but without the audio field
//
// Returns today's Reddit pulse as a playlist. Source is the per-post rows in
// reddit_post_summaries (Mac Mini's Gemini + Google TTS pipeline writes one
// row per post with the m4a audio inline in `tts_audio` as base64).
//
// The audio field is a URL to /api/reddit-briefing/clip/<postId> — *not* an
// inline data URL. iOS Safari refuses to play long `data:audio/mp4` URLs
// reliably (the m4a-in-mp4 MIME is ambiguous on its data-URL fast path), so
// the player consumes the clip via a regular HTTP stream which Safari
// handles natively. As a side benefit the JSON payload is small and audio
// is fetched lazily, one clip at a time.

import type { NextRequest } from 'next/server';
import { fetchRedditPulse } from '@/lib/fetchers/reddit-pulse';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
};

export async function GET(req: NextRequest) {
  const textOnly = req.nextUrl.searchParams.get('mode') === 'text';

  const pulse = await fetchRedditPulse();
  if (!pulse || pulse.items.length === 0) {
    return Response.json({ items: [] }, { headers: CACHE_HEADERS });
  }

  const items = pulse.items.map((it) => ({
    slot: it.postId, // unique identity per playlist position
    label: it.title,
    summary: it.summary,
    postCount: it.numComments ?? 0, // "X comments" in the player ticker
    createdAt: it.generatedAt,
    postId: it.postId,
    flair: it.flair,
    score: it.score,
    numComments: it.numComments,
    communityReaction: it.communityReaction,
    ...(textOnly
      ? {}
      : { audio: it.audioDataUrl ? `/api/reddit-briefing/clip/${it.postId}` : null }),
  }));

  return Response.json({ items }, { headers: CACHE_HEADERS });
}
