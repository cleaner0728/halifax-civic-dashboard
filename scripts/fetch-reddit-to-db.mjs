// Fetches r/halifax hot posts + full nested comment trees via Playwright (real Chromium)
// and upserts all available Reddit API fields into Supabase.
// Playwright bypasses Reddit's API blocks that affect direct HTTP requests.

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import postgres from 'postgres';

chromium.use(StealthPlugin());

const SUB = 'halifax';
const POST_LIMIT = 25;
const COMMENT_DEPTH = 10;
const COMMENT_LIMIT = 500;
const DB_CHUNK = 100;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS reddit_posts (
      -- Identity
      id                          TEXT PRIMARY KEY,
      name                        TEXT,                  -- fullname e.g. t3_abc123
      subreddit                   TEXT NOT NULL,
      subreddit_id                TEXT,
      subreddit_type              TEXT,
      subreddit_subscribers       INTEGER,

      -- Content
      title                       TEXT NOT NULL,
      selftext                    TEXT,
      url                         TEXT,
      permalink                   TEXT,
      domain                      TEXT,
      post_hint                   TEXT,                  -- 'self' | 'image' | 'video' | 'link' | 'rich:video'

      -- Flags
      is_self                     BOOLEAN DEFAULT FALSE,
      is_video                    BOOLEAN DEFAULT FALSE,
      is_original_content         BOOLEAN DEFAULT FALSE,
      is_gallery                  BOOLEAN DEFAULT FALSE,
      is_reddit_media_domain      BOOLEAN DEFAULT FALSE,
      over_18                     BOOLEAN DEFAULT FALSE,
      spoiler                     BOOLEAN DEFAULT FALSE,
      stickied                    BOOLEAN DEFAULT FALSE,
      pinned                      BOOLEAN DEFAULT FALSE,
      locked                      BOOLEAN DEFAULT FALSE,
      archived                    BOOLEAN DEFAULT FALSE,
      distinguished               TEXT,                  -- NULL | 'moderator' | 'admin'
      removed_by_category         TEXT,

      -- Author
      author                      TEXT,
      author_fullname             TEXT,
      author_flair_text           TEXT,
      author_flair_type           TEXT,
      author_flair_background_color TEXT,
      author_flair_text_color     TEXT,
      author_is_blocked           BOOLEAN DEFAULT FALSE,

      -- Engagement
      score                       INTEGER DEFAULT 0,
      upvote_ratio                REAL DEFAULT 0,
      ups                         INTEGER DEFAULT 0,
      downs                       INTEGER DEFAULT 0,
      num_comments                INTEGER DEFAULT 0,
      num_crossposts              INTEGER DEFAULT 0,
      gilded                      INTEGER DEFAULT 0,
      total_awards_received       INTEGER DEFAULT 0,

      -- Link flair (great for classification)
      link_flair_text             TEXT,
      link_flair_type             TEXT,
      link_flair_background_color TEXT,
      link_flair_text_color       TEXT,
      link_flair_css_class        TEXT,
      link_flair_richtext         JSONB,

      -- Media & preview (complex objects stored as JSONB)
      thumbnail                   TEXT,
      thumbnail_width             INTEGER,
      thumbnail_height            INTEGER,
      media                       JSONB,
      media_metadata              JSONB,
      secure_media                JSONB,
      preview                     JSONB,
      gallery_data                JSONB,

      -- Cross-post
      crosspost_parent            TEXT,
      crosspost_parent_list       JSONB,

      -- Timestamps
      created_utc                 BIGINT,
      edited_utc                  BIGINT,          -- NULL if not edited

      -- Tracking
      last_fetched_at             TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reddit_comments (
      -- Identity
      id                          TEXT PRIMARY KEY,
      name                        TEXT,                  -- fullname e.g. t1_abc123
      post_id                     TEXT NOT NULL REFERENCES reddit_posts(id) ON DELETE CASCADE,
      parent_id                   TEXT,                  -- NULL = top-level; otherwise parent comment id
      link_id                     TEXT,                  -- fullname of the post (t3_xxx)

      -- Content
      body                        TEXT,

      -- Author
      author                      TEXT,
      author_fullname             TEXT,
      author_flair_text           TEXT,
      author_flair_type           TEXT,
      author_flair_background_color TEXT,
      author_flair_text_color     TEXT,
      is_submitter                BOOLEAN DEFAULT FALSE, -- OP replying to own post

      -- Engagement
      score                       INTEGER DEFAULT 0,
      ups                         INTEGER DEFAULT 0,
      downs                       INTEGER DEFAULT 0,
      gilded                      INTEGER DEFAULT 0,
      total_awards_received       INTEGER DEFAULT 0,
      controversiality            INTEGER DEFAULT 0,     -- 0 or 1
      score_hidden                BOOLEAN DEFAULT FALSE,

      -- Tree
      depth                       INTEGER DEFAULT 0,

      -- State
      stickied                    BOOLEAN DEFAULT FALSE,
      locked                      BOOLEAN DEFAULT FALSE,
      archived                    BOOLEAN DEFAULT FALSE,
      distinguished               TEXT,
      removed_by_category         TEXT,
      collapsed                   BOOLEAN DEFAULT FALSE,
      collapsed_reason            TEXT,
      collapsed_because_crowd_control INTEGER,

      -- Timestamps
      created_utc                 BIGINT,
      edited_utc                  BIGINT,

      -- Tracking
      fetched_at                  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // first_seen_at: set on INSERT, never updated — used for 24h tracking window
  await sql`ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW()`;
  // body_html is redundant with body — drop if still present
  await sql`ALTER TABLE reddit_comments DROP COLUMN IF EXISTS body_html`;

  await sql`CREATE INDEX IF NOT EXISTS reddit_comments_post_id_idx       ON reddit_comments(post_id)`;
  await sql`CREATE INDEX IF NOT EXISTS reddit_comments_parent_id_idx     ON reddit_comments(parent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS reddit_comments_depth_idx         ON reddit_comments(depth)`;
  await sql`CREATE INDEX IF NOT EXISTS reddit_posts_created_utc_idx      ON reddit_posts(created_utc DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS reddit_posts_first_seen_at_idx    ON reddit_posts(first_seen_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS reddit_posts_link_flair_text_idx  ON reddit_posts(link_flair_text)`;
  await sql`CREATE INDEX IF NOT EXISTS reddit_posts_domain_idx           ON reddit_posts(domain)`;
  await sql`CREATE INDEX IF NOT EXISTS reddit_posts_score_idx            ON reddit_posts(score DESC)`;
}

// ---------------------------------------------------------------------------
// Reddit data mappers
// ---------------------------------------------------------------------------

function parseEdited(v) {
  if (!v || v === false) return null;
  return typeof v === 'number' ? v : null;
}

function mapPost(p) {
  return {
    id:                           p.id,
    name:                         p.name ?? null,
    subreddit:                    p.subreddit ?? SUB,
    subreddit_id:                 p.subreddit_id ?? null,
    subreddit_type:               p.subreddit_type ?? null,
    subreddit_subscribers:        p.subreddit_subscribers ?? null,

    title:                        p.title ?? '',
    selftext:                     p.selftext || null,
    url:                          p.url ?? null,
    permalink:                    p.permalink ?? null,
    domain:                       p.domain ?? null,
    post_hint:                    p.post_hint ?? null,

    is_self:                      p.is_self ?? false,
    is_video:                     p.is_video ?? false,
    is_original_content:          p.is_original_content ?? false,
    is_gallery:                   p.is_gallery ?? false,
    is_reddit_media_domain:       p.is_reddit_media_domain ?? false,
    over_18:                      p.over_18 ?? false,
    spoiler:                      p.spoiler ?? false,
    stickied:                     p.stickied ?? false,
    pinned:                       p.pinned ?? false,
    locked:                       p.locked ?? false,
    archived:                     p.archived ?? false,
    distinguished:                p.distinguished ?? null,
    removed_by_category:          p.removed_by_category ?? null,

    author:                       p.author ?? null,
    author_fullname:              p.author_fullname ?? null,
    author_flair_text:            p.author_flair_text ?? null,
    author_flair_type:            p.author_flair_type ?? null,
    author_flair_background_color: p.author_flair_background_color ?? null,
    author_flair_text_color:      p.author_flair_text_color ?? null,
    author_is_blocked:            p.author_is_blocked ?? false,

    score:                        p.score ?? 0,
    upvote_ratio:                 p.upvote_ratio ?? 0,
    ups:                          p.ups ?? 0,
    downs:                        p.downs ?? 0,
    num_comments:                 p.num_comments ?? 0,
    num_crossposts:               p.num_crossposts ?? 0,
    gilded:                       p.gilded ?? 0,
    total_awards_received:        p.total_awards_received ?? 0,

    link_flair_text:              p.link_flair_text ?? null,
    link_flair_type:              p.link_flair_type ?? null,
    link_flair_background_color:  p.link_flair_background_color ?? null,
    link_flair_text_color:        p.link_flair_text_color ?? null,
    link_flair_css_class:         p.link_flair_css_class ?? null,
    link_flair_richtext:          p.link_flair_richtext ? JSON.stringify(p.link_flair_richtext) : null,

    thumbnail:                    (p.thumbnail && p.thumbnail.startsWith('http')) ? p.thumbnail : null,
    thumbnail_width:              p.thumbnail_width ?? null,
    thumbnail_height:             p.thumbnail_height ?? null,
    media:                        p.media ? JSON.stringify(p.media) : null,
    media_metadata:               p.media_metadata ? JSON.stringify(p.media_metadata) : null,
    secure_media:                 p.secure_media ? JSON.stringify(p.secure_media) : null,
    preview:                      p.preview ? JSON.stringify(p.preview) : null,
    gallery_data:                 p.gallery_data ? JSON.stringify(p.gallery_data) : null,

    crosspost_parent:             p.crosspost_parent ?? null,
    crosspost_parent_list:        p.crosspost_parent_list ? JSON.stringify(p.crosspost_parent_list) : null,

    created_utc:                  p.created_utc ?? null,
    edited_utc:                   parseEdited(p.edited),
  };
}

function mapComment(c, postId, parentCommentId, depth) {
  return {
    id:                           c.id,
    name:                         c.name ?? null,
    post_id:                      postId,
    parent_id:                    parentCommentId ?? null,
    link_id:                      c.link_id ?? null,

    body:                         c.body ?? null,

    author:                       c.author ?? null,
    author_fullname:              c.author_fullname ?? null,
    author_flair_text:            c.author_flair_text ?? null,
    author_flair_type:            c.author_flair_type ?? null,
    author_flair_background_color: c.author_flair_background_color ?? null,
    author_flair_text_color:      c.author_flair_text_color ?? null,
    is_submitter:                 c.is_submitter ?? false,

    score:                        c.score ?? 0,
    ups:                          c.ups ?? 0,
    downs:                        c.downs ?? 0,
    gilded:                       c.gilded ?? 0,
    total_awards_received:        c.total_awards_received ?? 0,
    controversiality:             c.controversiality ?? 0,
    score_hidden:                 c.score_hidden ?? false,

    depth,

    stickied:                     c.stickied ?? false,
    locked:                       c.locked ?? false,
    archived:                     c.archived ?? false,
    distinguished:                c.distinguished ?? null,
    removed_by_category:          c.removed_by_category ?? null,
    collapsed:                    c.collapsed ?? false,
    collapsed_reason:             c.collapsed_reason ?? null,
    collapsed_because_crowd_control: c.collapsed_because_crowd_control ?? null,

    created_utc:                  c.created_utc ?? null,
    edited_utc:                   parseEdited(c.edited),
  };
}

function flattenComments(children, postId, parentCommentId, depth) {
  const result = [];
  for (const child of (children ?? [])) {
    if (child.kind === 'more') continue;
    if (child.kind !== 't1') continue;
    const d = child.data;
    result.push(mapComment(d, postId, parentCommentId, depth));
    if (d.replies?.data?.children?.length) {
      result.push(...flattenComments(d.replies.data.children, postId, d.id, depth + 1));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Playwright fetch helpers
// ---------------------------------------------------------------------------

// Use in-page fetch() so Reddit's session cookies (set by the stealth browser
// navigation) are automatically included in every API call.
async function inPageFetch(page, url) {
  const result = await page.evaluate(async (u) => {
    const res = await fetch(u, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }, url);
  return JSON.parse(result);
}

async function fetchHotPosts(page) {
  const url = `https://www.reddit.com/r/${SUB}/hot.json?limit=${POST_LIMIT}&raw_json=1`;
  const data = await inPageFetch(page, url);
  const children = data?.data?.children ?? [];
  return children.filter(c => c.kind === 't3').map(c => mapPost(c.data));
}

async function fetchComments(page, postId, retries = 3) {
  const url = `https://www.reddit.com/r/${SUB}/comments/${postId}.json?limit=${COMMENT_LIMIT}&depth=${COMMENT_DEPTH}&raw_json=1`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = await inPageFetch(page, url);
      if (!Array.isArray(data) || data.length < 2) return [];
      return flattenComments(data[1]?.data?.children, postId, null, 0);
    } catch (err) {
      // Reddit returns transient 503s under load; retry with backoff and
      // skip this post if it keeps failing so one bad post doesn't abort the run.
      if (attempt === retries) {
        console.warn(`[reddit-db]   skip ${postId}: ${err.message}`);
        return [];
      }
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
}

// ---------------------------------------------------------------------------
// DB upsert helpers
// ---------------------------------------------------------------------------

async function upsertPosts(sql, posts) {
  for (let i = 0; i < posts.length; i += DB_CHUNK) {
    await sql`
      INSERT INTO reddit_posts ${sql(posts.slice(i, i + DB_CHUNK))}
      ON CONFLICT (id) DO UPDATE SET
        score                   = EXCLUDED.score,
        upvote_ratio            = EXCLUDED.upvote_ratio,
        ups                     = EXCLUDED.ups,
        num_comments            = EXCLUDED.num_comments,
        selftext                = EXCLUDED.selftext,
        locked                  = EXCLUDED.locked,
        removed_by_category     = EXCLUDED.removed_by_category,
        total_awards_received   = EXCLUDED.total_awards_received,
        last_fetched_at         = NOW()
    `;
  }
}

async function upsertComments(sql, comments) {
  for (let i = 0; i < comments.length; i += DB_CHUNK) {
    await sql`
      INSERT INTO reddit_comments ${sql(comments.slice(i, i + DB_CHUNK))}
      ON CONFLICT (id) DO UPDATE SET
        score                   = EXCLUDED.score,
        ups                     = EXCLUDED.ups,
        body                    = EXCLUDED.body,
        collapsed               = EXCLUDED.collapsed,
        removed_by_category     = EXCLUDED.removed_by_category,
        total_awards_received   = EXCLUDED.total_awards_received,
        fetched_at              = NOW()
    `;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) { console.error('[reddit-db] SUPABASE_DB_URL not set'); process.exit(1); }

  const t0 = Date.now();
  const sql = postgres(dbUrl, { prepare: false, max: 3 });

  let browser;
  try {
    await ensureTables(sql);
    console.log('[reddit-db] tables ready');

    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      locale: 'en-CA',
      timezoneId: 'America/Halifax',
    });
    const page = await ctx.newPage();

    // Navigate to r/halifax first so the stealth browser passes Reddit's
    // JS challenge and gets session cookies — in-page fetch calls work after this.
    await page.goto(`https://www.reddit.com/r/${SUB}/`, { waitUntil: 'networkidle', timeout: 60_000 });
    console.log('[reddit-db] session established');

    const posts = await fetchHotPosts(page);
    console.log(`[reddit-db] ${posts.length} posts`);

    await upsertPosts(sql, posts);
    console.log(`[reddit-db] ${posts.length} posts upserted`);

    let totalComments = 0;

    // ── Top 25 hot posts ────────────────────────────────────────────────────
    for (const post of posts) {
      const comments = await fetchComments(page, post.id);
      if (comments.length > 0) await upsertComments(sql, comments);
      totalComments += comments.length;
      console.log(`[reddit-db]   ${post.id} "${post.title.slice(0, 55)}" → ${comments.length} comments`);
      await new Promise(r => setTimeout(r, 1200));
    }

    // ── 24h tracking: posts that have fallen out of hot but are still fresh ─
    const currentIds = posts.map(p => p.id);
    const trackedPosts = await sql`
      SELECT id, title FROM reddit_posts
      WHERE subreddit = ${SUB}
        AND first_seen_at > NOW() - INTERVAL '24 hours'
        AND id != ALL(${sql.array(currentIds)})
    `;
    if (trackedPosts.length > 0) {
      console.log(`[reddit-db] ${trackedPosts.length} tracked posts (24h window, out of hot)`);
      for (const post of trackedPosts) {
        const comments = await fetchComments(page, post.id);
        if (comments.length > 0) await upsertComments(sql, comments);
        totalComments += comments.length;
        console.log(`[reddit-db]   (tracked) ${post.id} "${post.title.slice(0, 55)}" → ${comments.length} comments`);
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    // ── Retention cleanup ───────────────────────────────────────────────────
    // Comments older than 30 days: delete directly (bulk of the space)
    const { count: deletedComments } = await sql`
      DELETE FROM reddit_comments
      WHERE fetched_at < NOW() - INTERVAL '30 days'
    `.then(r => ({ count: r.count }));
    // Posts older than 90 days: delete (CASCADE removes their comments too)
    const { count: deletedPosts } = await sql`
      DELETE FROM reddit_posts
      WHERE first_seen_at < NOW() - INTERVAL '90 days'
    `.then(r => ({ count: r.count }));
    if (Number(deletedComments) > 0 || Number(deletedPosts) > 0) {
      console.log(`[reddit-db] cleanup — removed ${deletedComments} comments (>30d), ${deletedPosts} posts (>90d)`);
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[reddit-db] done — ${posts.length} hot + ${trackedPosts.length} tracked posts, ${totalComments} comments in ${elapsed}s`);
  } finally {
    if (browser) await browser.close();
    await sql.end({ timeout: 5 });
  }
}

main().catch(err => { console.error('[reddit-db] failed:', err); process.exit(1); });
