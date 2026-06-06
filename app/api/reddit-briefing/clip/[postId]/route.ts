// GET /api/reddit-briefing/clip/<postId>  → raw m4a bytes
//
// Streams a single Reddit pulse clip as a regular audio file. The main
// /api/reddit-briefing endpoint used to inline every clip's audio as a
// `data:audio/mp4;base64,…` URL in its JSON payload, which iOS Safari
// refuses to play reliably. Serving the bytes as a normal HTTP response
// is the path iOS handles natively — but only if we respect HTTP Range
// semantics. iOS WebKit issues a probe `Range: bytes=0-1` request before
// it'll even start playback; if the server claims `Accept-Ranges: bytes`
// in the response but returns 200 OK + the full body instead of 206
// Partial Content, iOS aborts and the audio never plays. This route
// implements proper Range handling so iPhone Safari / Chrome / Firefox
// (all WebKit on iOS) actually start streaming.

import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";

// `mp4a.40.2` is the AAC-LC profile that Google Cloud TTS emits and
// the only audio codec actually present in these m4a files. Naming it
// explicitly removes any ambiguity from WebKit's codec detection.
const CONTENT_TYPE = 'audio/mp4; codecs="mp4a.40.2"';
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function GET(
  req: NextRequest,
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
  _req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postId) return new Response(null, { status: 400 });

  let rows: { length: number | null }[];
  try {
    // octet_length gives us the byte size without shipping the whole
    // base64 across the connection.
    rows = await sql<{ length: number | null }[]>`
      SELECT (octet_length(decode(tts_audio, 'base64')))::int AS length
      FROM reddit_post_summaries
      WHERE post_id = ${postId} AND tts_audio IS NOT NULL
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
