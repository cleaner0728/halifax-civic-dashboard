// Reads top posts+comments from Supabase, queries Gemini via Playwright Firefox,
// stores per-post summaries (≤300 words) + generates TTS audio via macOS `say`.
//
// Post selection:
//   - Top 3 by comment count  (most discussed)
//   - Top 3 by score          (high score, potentially low comments)
//   Both pools deduped, then ordered to match Reddit's own "hot" ranking:
//   stickied posts first, then by hot score = log10(|score|) + score_sign·(created_utc − reddit_epoch)/45000.
//   (Reddit's hot is dominated by age: every ~12.5h of age ≈ +1, worth a 10× score bump.)
//
// Output table: reddit_post_summaries
//   - One row per post per day (skips if already summarized today)
//   - summary_text ≤ 300 words
//   - tts_path: relative URL to M4A audio file served from /public/tts/
//
// Run: node scripts/summarize-reddit-mac-mini.mjs

import { firefox } from 'playwright';
import postgres from 'postgres';
import { readFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = resolve(__dir, '..', '.gemini-session.json');
const TTS_BIN = '/Users/karl_li/Library/Python/3.9/bin/edge-tts';
const TTS_VOICE_EN = 'en-US-AriaNeural';
const TTS_VOICE_ZH = 'zh-CN-XiaoxiaoNeural';

const SUB = 'halifax';
const TOP_N = 3;
const MAX_COMMENTS_PER_POST = 25;
const MAX_REPLIES_PER_COMMENT = 3;

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS reddit_post_summaries (
      id                 SERIAL PRIMARY KEY,
      generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      summary_date       DATE NOT NULL,
      post_id            TEXT NOT NULL,
      title              TEXT,
      flair              TEXT,
      score              INTEGER,
      num_comments       INTEGER,
      selection_reason   TEXT,
      rank               REAL,
      summary_text       TEXT NOT NULL,
      word_count         INTEGER,
      community_reaction TEXT,
      tts_audio          TEXT,
      summary_text_zh       TEXT,
      community_reaction_zh TEXT,
      tts_audio_zh          TEXT,
      source             TEXT NOT NULL DEFAULT 'mac_mini_server',
      model              TEXT NOT NULL DEFAULT 'gemini',
      UNIQUE (summary_date, post_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS reddit_post_summaries_date_idx
    ON reddit_post_summaries (summary_date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS reddit_post_summaries_post_id_idx
    ON reddit_post_summaries (post_id)`;
}

// ---------------------------------------------------------------------------
// Post & comment selection
// ---------------------------------------------------------------------------

// Reddit's "hot" ranking score. Mirrors the historical Reddit algorithm:
//   order = log10(max(|score|, 1))
//   sign  = +1 / 0 / -1 depending on score
//   hot   = order + sign · (created_utc − REDDIT_EPOCH) / 45000
// REDDIT_EPOCH is a fixed constant (2005-12-08), so it cancels out when
// comparing posts — but we keep it so the absolute values match Reddit's.
const REDDIT_EPOCH = 1134028003;

function redditHotScore(score, createdUtc) {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const seconds = createdUtc - REDDIT_EPOCH;
  return order + (sign * seconds) / 45000;
}

async function selectPosts(sql) {
  const byComments = await sql`
    SELECT id, title, selftext, score, num_comments, upvote_ratio,
           link_flair_text, permalink, created_utc, first_seen_at, stickied
    FROM reddit_posts
    WHERE subreddit = ${SUB}
      AND first_seen_at > NOW() - INTERVAL '24 hours'
    ORDER BY num_comments DESC LIMIT ${TOP_N}
  `;
  const topCommentIds = byComments.map(p => p.id);

  const byScore = await sql`
    SELECT id, title, selftext, score, num_comments, upvote_ratio,
           link_flair_text, permalink, created_utc, first_seen_at, stickied
    FROM reddit_posts
    WHERE subreddit = ${SUB}
      AND first_seen_at > NOW() - INTERVAL '24 hours'
      AND id != ALL(${sql.array(topCommentIds)})
    ORDER BY score DESC LIMIT ${TOP_N}
  `;

  const all = [
    ...byComments.map(p => ({ ...p, selection_reason: 'top_comments' })),
    ...byScore.map(p => ({ ...p, selection_reason: 'top_score' })),
  ];

  // Order exactly like Reddit's "hot" listing: stickied posts pinned to the
  // top, everything else by hot score descending.
  return all
    .map(p => ({ ...p, rank: redditHotScore(p.score, Number(p.created_utc)) }))
    .sort((a, b) => (Number(b.stickied) - Number(a.stickied)) || (b.rank - a.rank));
}

async function fetchComments(sql, postIds) {
  const rows = await sql`
    SELECT id, post_id, parent_id, author, body, score, depth
    FROM reddit_comments
    WHERE post_id = ANY(${sql.array(postIds)})
    ORDER BY score DESC
  `;
  const map = {};
  for (const r of rows) {
    if (!map[r.post_id]) map[r.post_id] = [];
    map[r.post_id].push(r);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

// Shared rendering of the posts+comments block, reused by the English and
// Chinese prompts so the two independent passes see identical source data.
function renderPostsBlock(posts, commentsMap) {
  return posts.map((post, i) => {
    const allComments = commentsMap[post.id] ?? [];
    const topLevel = allComments
      .filter(c => c.depth === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_COMMENTS_PER_POST);

    const commentLines = topLevel.map(c => {
      const replies = allComments
        .filter(r => r.parent_id === c.id)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_REPLIES_PER_COMMENT)
        .map(r => `    ↳ [${r.author}] ${(r.body ?? '').slice(0, 150)}`)
        .join('\n');
      return `  • [${c.author}] (${c.score}pts) ${(c.body ?? '').slice(0, 200)}${replies ? '\n' + replies : ''}`;
    }).join('\n');

    const label = post.selection_reason === 'top_comments' ? 'Most Discussed' : 'Top Rated';
    return [
      `[POST ${i + 1}] ${label}`,
      `ID: ${post.id}`,
      `Title: ${post.title}`,
      `Flair: ${post.link_flair_text ?? 'none'}`,
      `Score: ${post.score} | Comments: ${post.num_comments}`,
      post.selftext ? `Body: ${post.selftext.slice(0, 500)}` : '',
      '',
      'Top Comments:',
      commentLines || '  (no comments yet)',
      '---',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

// English summarization pass.
function buildPrompt(posts, commentsMap) {
  const postsText = renderPostsBlock(posts, commentsMap);
  return `CRITICAL OUTPUT RULE: Your entire reply must be ONE single JSON object and nothing else. Do NOT write any introduction, heading, or sentence such as "Here are the summaries". Do NOT use markdown or code fences. The very first character of your reply must be { and the very last must be }.

IMPORTANT: Do NOT use Google Search or any external tools. All data is provided below. Do not search the internet.

You are summarizing discussions on r/halifax (Halifax, Nova Scotia) for a daily audio briefing.

There are exactly ${posts.length} posts below (POST 1 through POST ${posts.length}). You MUST summarize ALL ${posts.length} of them — do not skip any, and do not assume any were already done in a previous conversation. Your "posts" array must contain exactly ${posts.length} elements.

For EACH post below, write a thorough summary covering:
1. What the post is about (context, key facts)
2. The main arguments, opinions, and debates in the comments
3. Any notable agreements, disagreements, or surprising community reactions
4. The overall sentiment

Each summary MUST be between 200 and 300 words. Do not write short summaries — the reader needs enough detail to understand the full discussion without reading the original thread. If a post has many comments, prioritize the most upvoted and most debated ones.

${postsText}

Return ONLY a valid JSON object with EXACTLY this shape and these key names — no markdown, no code fences, no explanation. The top level MUST be an object with a single key "posts" whose value is an array, one element per post. Do NOT invent flat keys like "post_1_summary". For each element, "post_id" MUST be the exact string shown after "ID:" for that post (for example "1tzmup0") — never a sequential number. CRITICAL: inside every string value, do NOT use the double-quote character ("). If you need to quote something, use single quotes ('). This keeps the JSON valid.
{
  "posts": [
    {
      "post_id": "<copy the exact ID: value for this post>",
      "summary": "thorough 200-300 word English summary covering post content AND community discussion",
      "community_reaction": "one short phrase: e.g. broadly supportive / divided / concerned / humorous / skeptical"
    }
  ]
}`;
}

// Independent Chinese summarization pass — its own Gemini conversation,
// summarizing the same posts entirely in Simplified Chinese (not a translation
// of the English run). Same JSON shape; main maps summary → summary_text_zh.
function buildPromptZh(posts, commentsMap) {
  const postsText = renderPostsBlock(posts, commentsMap);
  return `关键输出规则：你的整条回复必须是一个 JSON 对象，除此之外不要有任何内容。不要写开场白、标题或“以下是总结”之类的句子。不要用 markdown 或代码块。回复的第一个字符必须是 {，最后一个字符必须是 }。

重要：不要使用 Google 搜索或任何外部工具。所有数据都在下面给出，不要联网。

你正在为一个每日音频简报总结 r/halifax（加拿大新斯科舍省哈利法克斯）的讨论。

下面一共有 ${posts.length} 个帖子（POST 1 到 POST ${posts.length}）。你必须用简体中文总结全部 ${posts.length} 个，一个都不能漏，也不要以为之前的对话里已经做过其中任何一个。你的 "posts" 数组必须正好包含 ${posts.length} 个元素。

对每个帖子，写一段详尽的中文总结，覆盖：
1. 帖子讲的是什么（背景、关键事实）
2. 评论区的主要观点、论点和争论
3. 任何值得注意的共识、分歧或令人意外的社区反应
4. 整体情绪

每段总结必须在 200 到 300 字之间，要足够详细，让读者不看原帖也能了解完整讨论。评论多的帖子，优先讲点赞最高、争论最多的。

${postsText}

只返回一个符合下面结构和键名的合法 JSON 对象——不要 markdown、不要代码块、不要解释。顶层必须是一个对象，只有一个键 "posts"，值是数组，每个帖子一个元素。不要自己发明 "post_1_summary" 这种扁平键。每个元素的 "post_id" 必须是该帖 "ID:" 后面那个确切字符串（例如 "1tzmup0"），绝不能用序号。关键：字符串内部不要使用英文双引号（"），需要引用就用单引号（'）或中文引号「」，否则 JSON 会失效。
{
  "posts": [
    {
      "post_id": "<复制该帖 ID: 后面的确切值>",
      "summary": "200-300字的详尽简体中文总结，覆盖帖子内容和评论区讨论",
      "community_reaction": "一个简短的中文短语，如：普遍支持 / 意见分歧 / 担忧 / 调侃 / 质疑"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Gemini via Playwright Firefox
// ---------------------------------------------------------------------------

async function queryGemini(prompt) {
  let sessionState;
  try {
    sessionState = JSON.parse(await readFile(SESSION_FILE, 'utf-8'));
  } catch {
    throw new Error(`Gemini session not found at ${SESSION_FILE} — run export-firefox-session.mjs first`);
  }

  const browser = await firefox.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ storageState: sessionState });
    const page = await ctx.newPage();

    await page.goto('https://gemini.google.com/app', { waitUntil: 'load', timeout: 60_000 });

    // Reset to a brand-new chat, defeating the server-side restore of the
    // previous conversation (which otherwise makes Gemini "continue" it with
    // drifted post_N_summary keys instead of our schema). There's a race: the
    // restored transcript can finish loading AFTER an early reset click, so we
    // let it settle, click New chat, then CONFIRM the transcript is empty
    // (no model-response left) — retrying if a late restore re-populated it.
    await page.waitForTimeout(3_000);
    let fresh = false;
    for (let attempt = 0; attempt < 5 && !fresh; attempt++) {
      await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[aria-label="New chat"]')];
        const real = links.find((a) => a.innerText.trim() === 'New chat') || links[links.length - 1];
        if (real) real.click();
      });
      await page.waitForTimeout(1_500);
      await page.keyboard.press('Escape').catch(() => {});
      const leftover = await page.evaluate(() => document.querySelectorAll('model-response').length);
      fresh = leftover === 0;
      if (!fresh) {
        console.log(`[gemini] reset attempt ${attempt + 1}: ${leftover} old responses still present`);
        await page.waitForTimeout(1_500);
      }
    }
    console.log(fresh ? '[gemini] fresh chat confirmed' : '[gemini] WARNING: could not fully clear previous chat');

    const inputSelectors = [
      'rich-textarea .ql-editor',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][data-placeholder]',
      'div[role="textbox"]',
    ];
    let inputEl = null;
    for (const sel of inputSelectors) {
      try {
        inputEl = await page.waitForSelector(sel, { timeout: 8_000 });
        if (inputEl) { console.log(`[gemini] input found: ${sel}`); break; }
      } catch { /* try next */ }
    }
    if (!inputEl) throw new Error('Could not find Gemini input area — session may have expired');

    // Focus via JS rather than a pointer click — a lingering tooltip overlay
    // from the New-chat reset can intercept a real click, but keyboard input
    // still reaches the focused editor.
    await page.evaluate(() => {
      const ed = document.querySelector(
        'rich-textarea .ql-editor, div.ql-editor[contenteditable="true"], div[role="textbox"]',
      );
      if (ed) ed.focus();
    });

    const CHUNK = 2000;
    for (let i = 0; i < prompt.length; i += CHUNK) {
      await page.keyboard.type(prompt.slice(i, i + CHUNK));
    }

    await page.keyboard.press('Enter');
    console.log('[gemini] prompt submitted, waiting for response…');

    const responseSelectors = [
      'model-response',
      'message-content .markdown',
      '.response-container',
      '[data-response-index]',
    ];
    let responseEl = null;
    for (const sel of responseSelectors) {
      try {
        responseEl = await page.waitForSelector(sel, { timeout: 30_000 });
        if (responseEl) { console.log(`[gemini] response container: ${sel}`); break; }
      } catch { /* try next */ }
    }
    if (!responseEl) throw new Error('Response container not found');

    let rawText = await waitForStableResponse(page);
    console.log(`[gemini] response received (${rawText.length} chars)`);
    if (!rawText.includes('{')) {
      console.log('[gemini] response was prose — re-asking for JSON');
      await sendMessage(page, inputSelectors,
        'Output ONLY the JSON object — starting with { and ending with }. No other text, no markdown fences. 只返回 JSON 对象。');
      rawText = await waitForStableResponse(page);
      console.log(`[gemini] retry received (${rawText.length} chars)`);
    }
    return rawText;
  } finally {
    await browser.close();
  }
}

async function sendMessage(page, inputSelectors, text) {
  let inputEl = null;
  for (const sel of inputSelectors) {
    try {
      inputEl = await page.waitForSelector(sel, { timeout: 5_000 });
      if (inputEl) break;
    } catch { /* try next */ }
  }
  if (!inputEl) throw new Error('Could not find input for follow-up message');
  await inputEl.click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

// True once the first {...} in the text is brace-balanced (i.e. the JSON object
// has fully streamed in). Used to avoid accepting a response that has merely
// paused after emitting "{" — Gemini does this between turns while it "thinks".
function bracesBalanced(s) {
  const start = s.indexOf('{');
  if (start === -1) return false;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) return true; }
  }
  return false;
}

async function waitForStableResponse(page) {
  const getText = () => page.evaluate(() => {
    const els = document.querySelectorAll('model-response, .response-container, message-content');
    const last = els[els.length - 1];
    return last ? last.innerText : '';
  });

  let prev = '';
  let stableCount = 0;
  for (let i = 0; i < 150; i++) {
    await page.waitForTimeout(2000);
    const current = await getText();
    // "Complete enough" = either it's prose (no brace, for the re-ask path) or
    // the JSON object has fully closed. Prevents returning a lone "{".
    const complete = current.length > 15 && (!current.includes('{') || bracesBalanced(current));
    if (current && current === prev && complete) {
      if (++stableCount >= 3) break;
    } else {
      stableCount = 0;
      prev = current;
    }
  }
  return prev;
}

// Extract the first top-level {...} object and clean up the common ways Gemini
// breaks JSON. The scan is *string-aware* (tracks whether we're inside a quoted
// string, honouring backslash escapes), which matters for two reasons:
//   1) braces that appear inside a summary string no longer throw off the depth
//      count → no more spurious "Unbalanced braces".
//   2) raw control chars (a real newline/tab the model dropped into a string)
//      are escaped instead of left to blow up JSON.parse with "Bad control
//      character" / "Expected ',' or '}'".
// Trailing commas before } or ] are stripped at the end.
function extractCleanJson(raw) {
  const text = raw.replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in Gemini response');

  let depth = 0;
  let inStr = false;
  let escaped = false;
  let out = '';
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === '\\') { out += ch; escaped = true; continue; }
      if (ch === '"') {
        // Closing quote vs an unescaped quote the model dropped inside the
        // value. A real closing quote is followed (after optional whitespace)
        // by a structural char — , : } ] — or EOF. Otherwise it's inner
        // content, so escape it and stay inside the string.
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        const nx = text[j];
        if (j >= text.length || nx === ',' || nx === ':' || nx === '}' || nx === ']') {
          out += '"';
          inStr = false;
        } else {
          out += '\\"';
        }
        continue;
      }
      const code = text.charCodeAt(i);
      if (code < 0x20) {
        // raw control char inside a string literal → escape (or drop)
        out += ch === '\n' ? '\\n' : ch === '\t' ? '\\t' : ch === '\r' ? '\\r' : ' ';
        continue;
      }
      out += ch;
      continue;
    }
    // outside a string
    if (ch === '"') { out += ch; inStr = true; continue; }
    if (ch === '{') { depth++; out += ch; continue; }
    if (ch === '}') {
      depth--; out += ch;
      if (depth === 0) return out.replace(/,(\s*[}\]])/g, '$1');
      continue;
    }
    out += ch;
  }
  throw new Error('Unbalanced braces in Gemini response');
}

function parseGeminiJson(raw) {
  const cleaned = extractCleanJson(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    // Last-ditch: collapse any remaining stray control chars everywhere and
    // retry once, so a single odd byte doesn't sink the whole run.
    return JSON.parse(cleaned.replace(/[\u0000-\u001F]/g, ''));
  }
}

// Gemini is inconsistent about the wrapper key (posts / summaries / …). Pull
// out whichever top-level value is an array of post objects, so a key-name
// drift doesn't cost us the whole run.
function extractPosts(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.posts)) return parsed.posts;
  if (Array.isArray(parsed?.summaries)) return parsed.summaries;
  for (const v of Object.values(parsed ?? {})) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Cleanup — delete previous days' summaries and their TTS files
// ---------------------------------------------------------------------------

async function cleanupPreviousDays(sql) {
  const old = await sql`
    DELETE FROM reddit_post_summaries WHERE summary_date < CURRENT_DATE
  `;
  if (old.count > 0) console.log(`[summarize] cleaned up ${old.count} previous-day summaries`);
}

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------

async function generateTtsBase64(text, voice) {
  const mp3Path = `/tmp/tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`;
  // edge-tts doesn't accept piped text — write to a temp txt file
  const txtPath = `${mp3Path}.txt`;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(txtPath, text, 'utf-8');
  execSync(`${TTS_BIN} --voice "${voice}" --file "${txtPath}" --write-media "${mp3Path}"`, { timeout: 60_000 });
  const buf = await readFile(mp3Path);
  const b64 = buf.toString('base64');
  await unlink(txtPath).catch(() => {});
  await unlink(mp3Path).catch(() => {});
  return b64;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) { console.error('[summarize] SUPABASE_DB_URL not set'); process.exit(1); }

  const t0 = Date.now();
  const sql = postgres(dbUrl, { prepare: false, max: 3 });

  try {
    await ensureTable(sql);
    // Migrate schema: swap tts_path → tts_audio
    await sql`ALTER TABLE reddit_post_summaries ADD COLUMN IF NOT EXISTS tts_audio TEXT`;
    await sql`ALTER TABLE reddit_post_summaries DROP COLUMN IF EXISTS tts_path`;
    // Chinese (Simplified) parallel columns — mirror the English ones.
    await sql`ALTER TABLE reddit_post_summaries ADD COLUMN IF NOT EXISTS summary_text_zh TEXT`;
    await sql`ALTER TABLE reddit_post_summaries ADD COLUMN IF NOT EXISTS community_reaction_zh TEXT`;
    await sql`ALTER TABLE reddit_post_summaries ADD COLUMN IF NOT EXISTS tts_audio_zh TEXT`;
    await cleanupPreviousDays(sql);

    const posts = await selectPosts(sql);
    if (posts.length === 0) {
      console.log('[summarize] no posts in last 24h, skipping');
      return;
    }
    console.log(`[summarize] selected ${posts.length} posts: ${posts.map(p => `${p.id}(${p.selection_reason})`).join(', ')}`);

    const postIds = posts.map(p => p.id);
    const commentsMap = await fetchComments(sql, postIds);
    const totalComments = Object.values(commentsMap).reduce((s, v) => s + v.length, 0);
    console.log(`[summarize] ${totalComments} comments loaded`);

    const enPrompt = buildPrompt(posts, commentsMap);
    const zhPrompt = buildPromptZh(posts, commentsMap);
    console.log(`[summarize] prompts: en ${enPrompt.length} / zh ${zhPrompt.length} chars`);

    // Two fully independent Gemini passes (each its own browser session and
    // conversation) — English summaries, then a separate all-Chinese summary.
    console.log('[summarize] === English pass ===');
    const englishRaw = await queryGemini(enPrompt);
    console.log('[summarize] === Chinese pass ===');
    const chineseRaw = await queryGemini(zhPrompt);

    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile('/tmp/gemini-en.txt', englishRaw);
      await writeFile('/tmp/gemini-zh.txt', chineseRaw);
    } catch { /* debug dump best-effort */ }

    let englishPosts;
    try {
      englishPosts = extractPosts(parseGeminiJson(englishRaw));
    } catch (e) {
      console.error('[summarize] English JSON parse failed:', e.message);
      console.error('[summarize] raw response (first 500):', englishRaw.slice(0, 500));
      process.exit(1);
    }
    if (englishPosts.length === 0) {
      console.error('[summarize] no posts array found in English response:', englishRaw.slice(0, 500));
      process.exit(1);
    }

    // Chinese is best-effort — if it fails to parse we still save the English.
    const zhMap = {};
    try {
      for (const z of extractPosts(parseGeminiJson(chineseRaw))) {
        const zpid = z.post_id ?? z.id;
        if (zpid) zhMap[zpid] = z;
      }
      console.log(`[summarize] parsed Chinese for ${Object.keys(zhMap).length} posts`);
    } catch (e) {
      console.error('[summarize] Chinese JSON parse failed (saving English only):', e.message);
    }

    const today = new Date().toISOString().slice(0, 10);
    let saved = 0;

    for (const item of englishPosts) {
      // Gemini sometimes names the id field "id" instead of "post_id".
      const postId = item.post_id ?? item.id;
      const meta = posts.find(p => p.id === postId);
      if (!meta) {
        console.warn(`[summarize] post_id ${postId} not found in selected posts, skipping`);
        continue;
      }

      const summaryText = item.summary ?? '';
      const wordCount = summaryText.split(/\s+/).filter(Boolean).length;
      const zh = zhMap[postId] ?? {};
      // The Chinese pass uses the same schema (summary / community_reaction);
      // accept the _zh-suffixed keys too in case Gemini adds them.
      const summaryZh = zh.summary ?? zh.summary_zh ?? '';
      const reactionZh = zh.community_reaction ?? zh.community_reaction_zh ?? null;

      // Generate English TTS → base64
      let ttsAudio = null;
      try {
        ttsAudio = await generateTtsBase64(summaryText, TTS_VOICE_EN);
        console.log(`[tts:en] generated ${postId} (${wordCount} words, ${(ttsAudio.length / 1024).toFixed(0)}KB b64)`);
      } catch (e) {
        console.error(`[tts:en] failed for ${postId}:`, e.message);
      }

      // Generate Chinese TTS → base64
      let ttsAudioZh = null;
      if (summaryZh) {
        try {
          ttsAudioZh = await generateTtsBase64(summaryZh, TTS_VOICE_ZH);
          console.log(`[tts:zh] generated ${postId} (${(ttsAudioZh.length / 1024).toFixed(0)}KB b64)`);
        } catch (e) {
          console.error(`[tts:zh] failed for ${postId}:`, e.message);
        }
      } else {
        console.warn(`[tts:zh] no summary_zh for ${postId} — Gemini omitted Chinese`);
      }

      await sql`
        INSERT INTO reddit_post_summaries
          (summary_date, post_id, title, flair, score, num_comments,
           selection_reason, rank, summary_text, word_count, community_reaction, tts_audio,
           summary_text_zh, community_reaction_zh, tts_audio_zh)
        VALUES (
          CURRENT_DATE,
          ${postId},
          ${meta.title ?? null},
          ${meta.link_flair_text ?? null},
          ${meta.score ?? null},
          ${meta.num_comments ?? null},
          ${meta.selection_reason ?? null},
          ${Number(meta.rank.toFixed(3))},
          ${summaryText},
          ${wordCount},
          ${item.community_reaction ?? null},
          ${ttsAudio},
          ${summaryZh || null},
          ${reactionZh},
          ${ttsAudioZh}
        )
        ON CONFLICT (summary_date, post_id) DO UPDATE SET
          summary_text = EXCLUDED.summary_text,
          word_count = EXCLUDED.word_count,
          community_reaction = EXCLUDED.community_reaction,
          tts_audio = EXCLUDED.tts_audio,
          summary_text_zh = EXCLUDED.summary_text_zh,
          community_reaction_zh = EXCLUDED.community_reaction_zh,
          tts_audio_zh = EXCLUDED.tts_audio_zh,
          generated_at = NOW()
      `;
      saved++;
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[summarize] saved ${saved} post summaries, ${totalComments} comments in ${elapsed}s`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(err => { console.error('[summarize] failed:', err); process.exit(1); });
