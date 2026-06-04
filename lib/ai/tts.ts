// Text-to-speech via Microsoft Edge's "Read Aloud" endpoint, accessed through
// the msedge-tts package. Free, unmetered, no API key — under the hood it's
// Azure Neural Voice, the same engine Edge's browser feature uses.
//
// Voice: en-US-AndrewMultilingualNeural — natural male informative tone,
// the closest match to the previous Chirp 3 HD "Charon" voice. Other good
// swaps:
//   Male:   en-US-AndrewNeural, en-US-BrianNeural, en-US-GuyNeural
//   Female: en-US-AvaMultilingualNeural, en-US-EmmaNeural, en-US-AriaNeural
//
// Returns MP3 bytes, or null on failure so callers degrade.

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const VOICE = 'en-US-AndrewMultilingualNeural';

export async function synthesizeSpeech(text: string): Promise<Buffer | null> {
  if (!text.trim()) return null;

  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk as Buffer);
    }
    if (chunks.length === 0) {
      console.error('[briefing] Edge TTS returned no audio');
      return null;
    }
    return Buffer.concat(chunks);
  } catch (e) {
    console.error('[briefing] Edge TTS fetch failed', e);
    return null;
  } finally {
    tts.close();
  }
}
