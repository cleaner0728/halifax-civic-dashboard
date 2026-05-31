// Text-to-speech via Google Gemini 2.5 Flash TTS — same AI Studio API key as
// the summary (free tier, no billing account needed). Plain REST, no SDK.
//
// Gemini TTS returns RAW 16-bit PCM (e.g. audio/L16;rate=24000), which browsers
// can't play directly, so we wrap it in a 44-byte WAV header and hand back
// WAV bytes. Returns null on any failure so callers can degrade.

const MODEL = 'gemini-2.5-flash-preview-tts';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Gemini prebuilt voices. Swap freely:
//   Charon (informative), Kore (firm), Orus, Fenrir, Puck, Zephyr, Leda, Aoede…
const VOICE = 'Charon';

// Natural-language style direction — Gemini TTS honours a leading instruction.
const STYLE = 'Read aloud in a warm, clear, professional radio news-anchor voice:';

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Pull the sample rate out of a mime like "audio/L16;codec=pcm;rate=24000".
function rateFromMime(mime: string | undefined): number {
  const m = mime?.match(/rate=(\d+)/);
  return m ? parseInt(m[1], 10) : 24000;
}

export async function synthesizeSpeech(text: string): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[briefing] GEMINI_API_KEY not set — skipping TTS');
    return null;
  }
  if (!text.trim()) return null;

  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE}\n\n${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
          },
        },
      }),
    });
    if (!res.ok) {
      console.error('[briefing] Gemini TTS error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts as
      | { inlineData?: { mimeType?: string; data?: string } }[]
      | undefined;
    const audioPart = (parts ?? []).find((p) => p.inlineData?.data);
    const b64 = audioPart?.inlineData?.data;
    if (!b64) {
      console.error('[briefing] Gemini TTS returned no audio');
      return null;
    }
    const pcm = Buffer.from(b64, 'base64');
    return pcmToWav(pcm, rateFromMime(audioPart?.inlineData?.mimeType));
  } catch (e) {
    console.error('[briefing] Gemini TTS fetch failed', e);
    return null;
  }
}
