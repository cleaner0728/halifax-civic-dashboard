// Fetches top hot posts from r/halifax and writes to public/reddit.json.
// Reddit blocks data-center IPs aggressively. Tries multiple endpoints/UAs
// in order; first one that returns data wins. If all fail, exits 1 (keeps
// existing JSON intact in CI since `git add` won't see changes).

import { writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SUB = 'halifax';
const LIMIT = 10;
const OUT_PATH = resolve('public/reddit.json');

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'curl/8.4.0',
];

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
    .slice(0, LIMIT)
    .map((p) => ({
      title: decodeEntities(p.title),
      score: p.score,
      numComments: p.num_comments,
      author: p.author,
      url: `https://www.reddit.com${p.permalink}`,
      flair: p.link_flair_text ? decodeEntities(p.link_flair_text) : null,
      createdUtc: p.created_utc,
    }));
}

function parseRss(xml) {
  if (!xml.includes('<entry>') && !xml.includes('<item>')) return null;
  // Reddit RSS uses Atom <entry> not RSS <item>
  const isAtom = xml.includes('<entry>');
  const blockRegex = isAtom ? /<entry>([\s\S]*?)<\/entry>/g : /<item>([\s\S]*?)<\/item>/g;
  const posts = [];
  let m;
  while ((m = blockRegex.exec(xml)) !== null && posts.length < LIMIT) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
      const mm = block.match(r);
      if (!mm) return '';
      return mm[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
    };
    const title = decodeEntities(get('title'));
    const linkMatch = block.match(/<link[^>]*href="([^"]+)"|<link[^>]*>([^<]+)<\/link>/);
    const url = linkMatch ? (linkMatch[1] || linkMatch[2]) : '';
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
  { name: 'www json (chrome)', url: `https://www.reddit.com/r/${SUB}/hot.json?limit=${LIMIT}&raw_json=1`, ua: UAS[0], accept: 'application/json', parse: parseJson },
  { name: 'www json (safari)', url: `https://www.reddit.com/r/${SUB}/hot.json?limit=${LIMIT}&raw_json=1`, ua: UAS[1], accept: 'application/json', parse: parseJson },
  { name: 'old json (chrome)', url: `https://old.reddit.com/r/${SUB}/hot.json?limit=${LIMIT}&raw_json=1`, ua: UAS[0], accept: 'application/json', parse: parseJson },
  { name: 'www rss (chrome)', url: `https://www.reddit.com/r/${SUB}/hot.rss?limit=${LIMIT}`, ua: UAS[0], accept: 'application/rss+xml, application/xml', parse: parseRss },
  { name: 'old rss (chrome)', url: `https://old.reddit.com/r/${SUB}/hot.rss?limit=${LIMIT}`, ua: UAS[0], accept: 'application/rss+xml, application/xml', parse: parseRss },
  { name: 'www rss (curl)', url: `https://www.reddit.com/r/${SUB}/hot.rss?limit=${LIMIT}`, ua: UAS[2], accept: '*/*', parse: parseRss },
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
    console.log(`✓ ${strat.name}: ${posts.length} posts`);
    await writeOutput(posts);
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
