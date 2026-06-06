// GET /api/reddit-briefing/clip/<postId>  → raw m4a bytes
//
// Streams a single Reddit pulse clip as a regular audio file. The main
// /api/reddit-briefing endpoint used to inline every clip's audio as a
// `data:audio/mp4;base64,…` URL in its JSON payload, which iOS Safari
// refuses to play reliably (the audio/mp4 MIME on a data URL is ambiguous
// between an m4a audio track and an mp4 video container, and Safari's
// data-URL fast path chokes on long base64 audio). Serving the bytes as a
// normal HTTP response is the only path iOS handles natively for m4a.

import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";

const AUDIO_HEADERS: Record<string, string> = {
  "Content-Type": "audio/mp4",
  // Audio for a given post_id never changes once the scraper writes it,
  // so this is safe to mark immutable. The summary_date in the row keeps
  // older posts addressable for as long as the pipeline retains them.
  "Cache-Control": "public, max-age=31536000, immutable",
  "Accept-Ranges": "bytes",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postId) {
    return new Response("missing postId", { status: 400 });
  }

  let rows: { tts_audio: string | null }[];
  try {
    rows = await sql<{ tts_audio: string | null }[]>`
      SELECT tts_audio
      FROM reddit_post_summaries
      WHERE post_id = ${postId}
      ORDER BY summary_date DESC, id DESC
      LIMIT 1
    `;
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "42P01") {
      // Table missing on fresh installs — same fallback the briefing
      // route uses. Treat as "no audio available".
      return new Response("not found", { status: 404 });
    }
    console.error("[reddit-briefing/clip] query failed:", e);
    return new Response("internal error", { status: 500 });
  }

  const b64 = rows[0]?.tts_audio;
  if (!b64) {
    return new Response("not found", { status: 404 });
  }

  const buffer = Buffer.from(b64, "base64");
  return new Response(new Uint8Array(buffer), {
    headers: {
      ...AUDIO_HEADERS,
      "Content-Length": String(buffer.length),
    },
  });
}
