// English → Simplified Chinese translation via Groq's hosted Llama 3.3 70B —
// the SAME provider and key (GROQ_API_KEY) already used for the English news
// summaries in lib/ai/summarize.ts, so no extra env var is needed on Vercel.
// Plain OpenAI-compatible REST, no SDK.
//
// Returns null on any failure so callers degrade gracefully — a missing
// translation leaves the Chinese column null and the reader falls back to
// English. It must never block or break the English path.

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export async function translateToChinese(text: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.warn('[translate] GROQ_API_KEY not set — skipping translation');
    return null;
  }
  if (!text.trim()) return null;

  const prompt =
    'Translate the following English news summary into natural, fluent ' +
    'Simplified Chinese (简体中文). It will be read aloud by a text-to-speech ' +
    'voice, so keep it conversational and easy to listen to. Output ONLY the ' +
    'Chinese translation — no preamble, no quotes, no notes.\n\n' +
    text;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });
    if (!res.ok) {
      console.error('[translate] Groq error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const out: string | undefined = data?.choices?.[0]?.message?.content;
    return out?.trim() || null;
  } catch (e) {
    console.error('[translate] Groq fetch failed', e);
    return null;
  }
}
