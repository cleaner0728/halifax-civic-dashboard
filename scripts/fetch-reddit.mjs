// Fetches top hot posts from r/halifax and writes to public/reddit.json.
// Run by .github/workflows/fetch-reddit.yml every 30 min. Reddit blocks most
// cloud IPs (Vercel, Cloudflare) but GitHub Actions runner IPs (Azure) still
// work as of writing. If this script fails, the existing JSON is left intact.

import { writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SUB = 'halifax';
const LIMIT = 10;
const OUT_PATH = resolve('public/reddit.json');
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchJson() {
  const url = `https://www.reddit.com/r/${SUB}/hot.json?limit=${LIMIT}&raw_json=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.data?.children) throw new Error('unexpected response shape');
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

async function main() {
  let posts;
  try {
    posts = await fetchJson();
    console.log(`Fetched ${posts.length} posts`);
  } catch (e) {
    console.error('Fetch failed:', e.message);
    process.exit(1);
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    posts,
  };

  // Skip write if nothing meaningful changed (titles+scores identical)
  try {
    const existing = JSON.parse(await readFile(OUT_PATH, 'utf-8'));
    const sigA = existing.posts?.map((p) => `${p.title}|${p.score}|${p.numComments}`).join('\n');
    const sigB = payload.posts.map((p) => `${p.title}|${p.score}|${p.numComments}`).join('\n');
    if (sigA === sigB) {
      console.log('No change, skipping write');
      return;
    }
  } catch {
    // file doesn't exist or unreadable; proceed to write
  }

  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
}

main();
