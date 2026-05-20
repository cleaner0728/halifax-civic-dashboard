// Generates favicon + PWA icons + header logo from seagull.png in repo root.
// Source should be a PNG with transparent background.
// Run: node scripts/generate-icons.mjs

import sharp from "sharp";

const SRC = "seagull.png";
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const SLATE_50 = { r: 248, g: 250, b: 252, alpha: 1 };

// `pad`: 0.0 = bird touches the frame edge, 0.08 = 8% safe-zone padding
// around the bird (needed for maskable-style Android adaptive icons).
async function makeIcon({ file, size, pad, bg }) {
  const content = Math.round(size * (1 - pad * 2));
  const bird = await sharp(SRC)
    .trim({ background: TRANSPARENT, threshold: 1 })
    .resize(content, content, { fit: "contain", background: TRANSPARENT })
    .toBuffer();
  const offset = Math.floor((size - content) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: bird, top: offset, left: offset }])
    .png()
    .toFile(file);
  console.log("wrote", file, `${size}×${size}`);
}

// Header logo: trimmed transparent, no background, no padding.
async function makeLogo({ file, height }) {
  await sharp(SRC)
    .trim({ background: TRANSPARENT, threshold: 1 })
    .resize({ height, fit: "contain", background: TRANSPARENT })
    .png()
    .toFile(file);
  console.log("wrote", file, `(height ${height})`);
}

await Promise.all([
  makeLogo({ file: "public/logo.png", height: 128 }),
  makeIcon({ file: "app/icon.png", size: 64, pad: 0, bg: TRANSPARENT }),
  // iOS home-screen — Apple paints transparent areas black, so use slate-50 bg.
  makeIcon({ file: "app/apple-icon.png", size: 180, pad: 0.08, bg: SLATE_50 }),
  // PWA install icons — slate-50 bg so the bird shows on dark launcher themes.
  makeIcon({ file: "public/icon-192.png", size: 192, pad: 0.08, bg: SLATE_50 }),
  makeIcon({ file: "public/icon-512.png", size: 512, pad: 0.08, bg: SLATE_50 }),
]);
