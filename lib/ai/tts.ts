// Text-to-speech via Google Cloud Text-to-Speech, Chirp 3: HD voices
// (free tier: 1M characters/month). Plain REST with API-key auth — no service
// account/OAuth. Returns MP3 bytes, or null on failure so callers degrade.
//
// SETUP: enable "Cloud Text-to-Speech API" on the GCP project and attach a
// billing account (required even for the free tier). Auth uses GOOGLE_TTS_API_KEY
// if set, otherwise falls back to GEMINI_API_KEY (works if that key isn't
// restricted to the Generative Language API only).

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

// Chirp 3 HD voices use Greek-letter names. Swap freely:
//   Male:   Charon (informative), Fenrir, Orus, Puck
//   Female: Leda, Aoede, Kore, Zephyr
const VOICE = 'en-US-Chirp3-HD-Charon';

export async function synthesizeSpeech(text: string): Promise<Buffer | null> {
  const key = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[briefing] no TTS API key set — skipping TTS');
    return null;
  }
  if (!text.trim()) return null;

  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'en-US', name: VOICE },
        // Chirp 3 HD doesn't support speakingRate/pitch — encoding only.
        audioConfig: { audioEncoding: 'MP3' },
      }),
    });
    if (!res.ok) {
      console.error('[briefing] Chirp TTS error', res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) {
      console.error('[briefing] Chirp TTS returned no audio');
      return null;
    }
    return Buffer.from(data.audioContent, 'base64');
  } catch (e) {
    console.error('[briefing] Chirp TTS fetch failed', e);
    return null;
  }
}
