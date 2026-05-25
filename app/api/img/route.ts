import type { NextRequest } from "next/server";

// Same-origin image proxy for news thumbnails. Browsers refuse to render
// images served by some upstream CDNs (notably i.cbc.ca) when fetched
// directly — Chrome's Opaque Response Blocking drops bytes whose
// Content-Type / nosniff combo it doesn't trust. Server-side `fetch` is
// not subject to ORB, so we pull the bytes here and re-emit them under
// our own origin where the browser is happy to display them.
//
// Why not next/image? next/image works (it's a server proxy too) but each
// unique (src, width, quality, format) tuple is billed as an Image
// Optimization transformation on Vercel. This route serves the original
// bytes, so it bills as a Function Invocation + bandwidth instead, which
// has far more headroom on the Hobby plan.

// Hostname allowlist. Keeps this from becoming an open proxy that anyone
// on the internet can use to fetch arbitrary URLs through our domain.
// Mirrors the news-feed sources in next.config.ts; webcam hosts that
// already use `unoptimized` direct fetches don't need an entry here.
const ALLOWED_HOST = /(?:^|\.)cbc\.ca$|^globalnews\.ca$|(?:^|\.)wp\.com$|(?:^|\.)halifaxexaminer\.ca$|^i\.redd\.it$|(?:^|\.)citynews\.ca$/i;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  if (target.protocol !== "https:") return new Response("https only", { status: 400 });
  if (!ALLOWED_HOST.test(target.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      // Some CDNs return a small HTML "blocked" body when no UA is set.
      // A generic browser-ish UA gets the actual image.
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HalifaxDashboardImageProxy)",
        Accept: "image/*,*/*;q=0.8",
      },
      // Hard upper bound so a slow upstream can't tie up a Function slot
      // for minutes. 10s is plenty for any reasonable image.
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("upstream error", { status: upstream.status || 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  // Refuse anything that isn't an image so this route can't be coerced
  // into serving HTML/JS even if an upstream URL is hijacked or 302s.
  if (!contentType.startsWith("image/")) {
    return new Response("not an image", { status: 415 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // s-maxage drives Vercel's edge CDN; once a given image URL has
      // been fetched once, subsequent hits within 31 days are served
      // from the edge without re-running this route. max-age covers
      // the user's own browser cache.
      "Cache-Control": "public, s-maxage=2592000, max-age=86400, immutable",
    },
  });
}
