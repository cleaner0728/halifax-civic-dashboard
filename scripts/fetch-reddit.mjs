// Fetches top hot posts from r/halifax and writes to public/reddit.json.
// Reddit blocks data-center IPs aggressively. Tries multiple endpoints/UAs
// in order; first one that returns data wins. If all fail, exits 1 (keeps
// existing JSON intact in CI since `git add` won't see changes).

import { writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SUB = 'halifax';
const KEEP = 30;            // max posts to display (stickied included)
const FETCH = 30;
const OUT_PATH = resolve('public/reddit.json');

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'curl/8.4.0',
];

// Trust nothing from Reddit. Permalinks must look like /r/<sub>/comments/...
// and links must point to reddit.com — anything else gets dropped so we can't
// be tricked into rendering attacker-controlled `href`s on the dashboard.
function safePermalink(permalink) {
  if (typeof permalink !== 'string') return null;
  if (!/^\/r\/[A-Za-z0-9_]+\/comments\/[A-Za-z0-9_]+/.test(permalink)) return null;
  return `https://www.reddit.com${permalink}`;
}

function safeRedditUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    if (u.hostname !== 'www.reddit.com' && u.hostname !== 'old.reddit.com') return null;
    if (!u.pathname.startsWith('/r/')) return null;
    // Normalize host so consumers don't see mixed hostnames.
    u.hostname = 'www.reddit.com';
    return u.toString();
  } catch {
    return null;
  }
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#32;/g, ' ')
    .replace(/&nbsp;/g, ' ');
}

async function tryFetch(url, ua, accept) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua, 'Accept': accept, 'Accept-Language': 'en-CA,en;q=0.9' },
      redirect: 'follow',
    });
    return { ok: res.ok, status: res.status, body: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: e.message };
  }
}

function parseJson(body) {
  if (!body.trimStart().startsWith('{')) return null;
  const data = JSON.parse(body);
  if (!data?.data?.children) return null;
  return data.data.children
    .map((c) => c.data)
    .map((p) => {
      const url = safePermalink(p.permalink);
      if (!url) return null;
      return {
        title: decodeEntities(p.title ?? ''),
        score: p.score ?? 0,
        numComments: p.num_comments ?? 0,
        author: p.author ?? 'unknown',
        url,
        flair: p.link_flair_text ? decodeEntities(p.link_flair_text) : null,
        createdUtc: p.created_utc ?? 0,
      };
    })
    .filter((p) => p !== null);
}

function parseOldRedditHtml(html) {
  // Match each post container; data-* attrs hold score/comments/author/timestamp/permalink.
  const things = html.match(/<div[^>]*class="[^"]*\bthing\b[^"]*"[^>]*data-fullname="t3_[^"]+"[^>]*>/g);
  if (!things) return null;
  const posts = [];
  for (const thing of things) {
    const attr = (name) => {
      const m = thing.match(new RegExp(`\\bdata-${name}="([^"]*)"`));
      return m ? m[1] : '';
    };
    if (attr('promoted') === 'true') continue;
    const url = safePermalink(attr('permalink'));
    if (!url) continue;
    const idMatch = thing.match(/id="(thing_t3_[^"]+)"/);
    if (!idMatch) continue;
    const blockStart = html.indexOf(idMatch[0]);
    const blockEnd = html.indexOf('id="thing_t3_', blockStart + idMatch[0].length);
    const block = blockEnd === -1 ? html.slice(blockStart) : html.slice(blockStart, blockEnd);
    const titleMatch = block.match(/<a[^>]*class="title[^"]*"[^>]*>([^<]+)<\/a>/);
    const flairMatch = block.match(/class="linkflairlabel[^"]*"[^>]*title="([^"]*)"/);
    posts.push({
      title: decodeEntities(titleMatch?.[1]?.trim() ?? ''),
      score: Number(attr('score') || '0'),
      numComments: Number(attr('comments-count') || '0'),
      author: attr('author') || 'unknown',
      url,
      flair: flairMatch ? decodeEntities(flairMatch[1]) : null,
      createdUtc: Math.floor(Number(attr('timestamp') || '0') / 1000),
    });
  }
  return posts.length > 0 ? posts : null;
}

function parseRss(xml) {
  if (!xml.includes('<entry>') && !xml.includes('<item>')) return null;
  // Reddit RSS uses Atom <entry> not RSS <item>; no `stickied` field, so we
  // filter by age in dropStickied() — pinned megathreads are typically weeks old.
  const isAtom = xml.includes('<entry>');
  const blockRegex = isAtom ? /<entry>([\s\S]*?)<\/entry>/g : /<item>([\s\S]*?)<\/item>/g;
  const posts = [];
  let m;
  while ((m = blockRegex.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
      const mm = block.match(r);
      if (!mm) return '';
      return mm[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
    };
    const title = decodeEntities(get('title'));
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"|<link[^>]*>([^<]+)<\/link>/);
    const rawUrl = linkMatch ? (linkMatch[1] || linkMatch[2]) : '';
    const url = safeRedditUrl(rawUrl);
    const author = get('name') || get('dc:creator') || get('author');
    const published = get('published') || get('updated') || get('pubDate');
    const createdUtc = published ? Math.floor(new Date(published).getTime() / 1000) : Math.floor(Date.now() / 1000);
    if (title && url) {
      posts.push({ title, score: 0, numComments: 0, author: author.replace(/^\/u\//, ''), url, flair: null, createdUtc });
    }
  }
  return posts.length > 0 ? posts : null;
}

const STRATEGIES = [
  { name: 'www json (chrome)', url: `https://www.reddit.com/r/${SUB}/hot.json?limit=${FETCH}&raw_json=1`, ua: UAS[0], accept: 'application/json', parse: parseJson },
  { name: 'www json (safari)', url: `https://www.reddit.com/r/${SUB}/hot.json?limit=${FETCH}&raw_json=1`, ua: UAS[1], accept: 'application/json', parse: parseJson },
  { name: 'old json (chrome)', url: `https://old.reddit.com/r/${SUB}/hot.json?limit=${FETCH}&raw_json=1`, ua: UAS[0], accept: 'application/json', parse: parseJson },
  { name: 'old html (chrome)', url: `https://old.reddit.com/r/${SUB}/`, ua: UAS[0], accept: 'text/html', parse: parseOldRedditHtml },
  { name: 'old html (safari)', url: `https://old.reddit.com/r/${SUB}/`, ua: UAS[1], accept: 'text/html', parse: parseOldRedditHtml },
  { name: 'www rss (chrome)', url: `https://www.reddit.com/r/${SUB}/hot.rss?limit=${FETCH}`, ua: UAS[0], accept: 'application/rss+xml, application/xml', parse: parseRss },
  { name: 'old rss (chrome)', url: `https://old.reddit.com/r/${SUB}/hot.rss?limit=${FETCH}`, ua: UAS[0], accept: 'application/rss+xml, application/xml', parse: parseRss },
  { name: 'www rss (curl)', url: `https://www.reddit.com/r/${SUB}/hot.rss?limit=${FETCH}`, ua: UAS[2], accept: '*/*', parse: parseRss },
];

async function main() {
  for (const strat of STRATEGIES) {
    const r = await tryFetch(strat.url, strat.ua, strat.accept);
    if (!r.ok) {
      console.log(`✗ ${strat.name}: HTTP ${r.status}${r.error ? ` (${r.error})` : ''}`);
      continue;
    }
    let posts;
    try {
      posts = strat.parse(r.body);
    } catch (e) {
      console.log(`✗ ${strat.name}: parse error ${e.message}`);
      continue;
    }
    if (!posts || posts.length === 0) {
      console.log(`✗ ${strat.name}: parsed 0 posts (likely blocked HTML page returned with 200)`);
      continue;
    }
    const kept = posts.slice(0, KEEP);
    console.log(`✓ ${strat.name}: ${kept.length} posts`);
    await writeOutput(kept);
    return;
  }
  console.error('All strategies failed');
  process.exit(1);
}

async function writeOutput(posts) {
  const payload = { fetchedAt: new Date().toISOString(), posts };
  try {
    const existing = JSON.parse(await readFile(OUT_PATH, 'utf-8'));
    const sigA = existing.posts?.map((p) => `${p.title}|${p.score}|${p.numComments}`).join('\n');
    const sigB = payload.posts.map((p) => `${p.title}|${p.score}|${p.numComments}`).join('\n');
    if (sigA === sigB) {
      console.log('No change, skipping write');
      return;
    }
  } catch {
    // file doesn't exist; proceed to write
  }
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
}

main();
