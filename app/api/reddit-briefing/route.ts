// GET /api/reddit-briefing           → { items: [{slot,label,summary,postCount,createdAt,audio,...}] }
// GET /api/reddit-briefing?mode=text → same, but without the audio field
//
// Returns today's Reddit pulse as a playlist. Source is the per-post rows in
// reddit_post_summaries (Mac Mini's Gemini + Google TTS pipeline writes one
// row per post with the m4a audio inline in `tts_audio` as base64).

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
    ...(textOnly ? {} : { audio: it.audioDataUrl }),
  }));

  return Response.json({ items }, { headers: CACHE_HEADERS });
}
