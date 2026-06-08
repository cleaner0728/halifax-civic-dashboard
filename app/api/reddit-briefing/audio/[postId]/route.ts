// GET /api/reddit-briefing/audio/<postId>  → raw MP3 bytes
//
// Streams a single Reddit pulse clip as a regular audio file. The path
// was previously /clip/<postId> + audio/mp4 Content-Type — discovered
// by direct curl probe that the bytes stored in
// `reddit_post_summaries.tts_audio` are actually MP3 (sync word `ff f3`
// + LAME encoder signature), not m4a/AAC as the column name suggested.
// iOS WebKit was rejecting the audio because the Content-Type advertised
// AAC-in-MP4 but the bytes were MP3 frames; the codec mismatch makes
// WebKit's media engine fail before playback even starts. The path was
// renamed from /clip/ to /audio/ to bust Vercel's CDN cache of the old
// wrong-Content-Type responses (the route had `immutable` headers).
//
// HTTP Range is honored properly (206 Partial Content with Content-Range)
// because iOS WebKit issues a probe `Range: bytes=0-1` before playback
// and refuses to start if the server claims Accept-Ranges but doesn't
// actually return 206 to a Range request.

import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";

// Plain MP3. The "tts_audio" column name is a misnomer — the upstream
// Mac Mini pipeline writes MP3 here, not m4a/AAC.
const CONTENT_TYPE = "audio/mpeg";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postId) {
    return new Response("missing postId", { status: 400 });
  }

  // lang=zh → the Chinese clip, falling back to English when it isn't there.
  const zh = req.nextUrl.searchParams.get("lang") === "zh";
  const audioCol = zh ? sql`COALESCE(tts_audio_zh, tts_audio)` : sql`tts_audio`;

  let rows: { audio: string | null }[];
  try {
    rows = await sql<{ audio: string | null }[]>`
      SELECT ${audioCol} AS audio
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

  const b64 = rows[0]?.audio;
  if (!b64) {
    return new Response("not found", { status: 404 });
  }

  const buffer = Buffer.from(b64, "base64");
  const total = buffer.length;

  // ── Range request: respond 206 Partial Content with the requested
  //    byte slice. iOS WebKit will refuse to play if we claim
  //    Accept-Ranges but ignore the Range header. Format per RFC 7233:
  //    `Range: bytes=START-END` (END may be missing → "to end of file").
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      const start = Number.parseInt(match[1], 10);
      const end = match[2] ? Number.parseInt(match[2], 10) : total - 1;
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end < total &&
        start <= end
      ) {
        const sliced = buffer.subarray(start, end + 1);
        return new Response(new Uint8Array(sliced), {
          status: 206,
          headers: {
            "Content-Type": CONTENT_TYPE,
            "Content-Length": String(sliced.length),
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": CACHE_CONTROL,
          },
        });
      }
      // Malformed/out-of-range — fall through to 416.
      return new Response("range not satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${total}`,
          "Accept-Ranges": "bytes",
        },
      });
    }
  }

  // No Range header — return the full body. Still advertise Range
  // support so iOS knows to use it for subsequent fetches.
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}

// Some streaming clients fire a HEAD before the GET to discover size +
// Range support. Mirror the headers the GET would emit so HEAD answers
// consistently and iOS doesn't get confused.
export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postId) return new Response(null, { status: 400 });

  const zh = req.nextUrl.searchParams.get("lang") === "zh";
  const audioCol = zh ? sql`COALESCE(tts_audio_zh, tts_audio)` : sql`tts_audio`;

  let rows: { length: number | null }[];
  try {
    // octet_length gives us the byte size without shipping the whole
    // base64 across the connection.
    rows = await sql<{ length: number | null }[]>`
      SELECT (octet_length(decode(${audioCol}, 'base64')))::int AS length
      FROM reddit_post_summaries
      WHERE post_id = ${postId} AND ${audioCol} IS NOT NULL
      ORDER BY summary_date DESC, id DESC
      LIMIT 1
    `;
  } catch {
    return new Response(null, { status: 500 });
  }

  const length = rows[0]?.length;
  if (!length) return new Response(null, { status: 404 });

  return new Response(null, {
    headers: {
      "Content-Type": CONTENT_TYPE,
      "Content-Length": String(length),
      "Accept-Ranges": "bytes",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
