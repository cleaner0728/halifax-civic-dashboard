// Generates PWA icons from an inline SVG. Run: node scripts/generate-icons.mjs
import sharp from "sharp";

const svg = (rounded) => `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.45" y2="1">
      <stop offset="0" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 115 : 0}" fill="url(#bg)"/>
  <rect x="168" y="156" width="200" height="216" rx="16" fill="#1e3a8a" opacity="0.5"/>
  <rect x="140" y="136" width="232" height="240" rx="22" fill="#ffffff"/>
  <rect x="166" y="164" width="180" height="34" rx="9" fill="#1d4ed8"/>
  <rect x="166" y="218" width="74" height="62" rx="9" fill="#93c5fd"/>
  <rect x="254" y="222" width="92" height="13" rx="6.5" fill="#cbd5e1"/>
  <rect x="254" y="245" width="92" height="13" rx="6.5" fill="#cbd5e1"/>
  <rect x="254" y="268" width="64" height="13" rx="6.5" fill="#cbd5e1"/>
  <rect x="166" y="300" width="180" height="13" rx="6.5" fill="#cbd5e1"/>
  <rect x="166" y="323" width="180" height="13" rx="6.5" fill="#cbd5e1"/>
  <rect x="166" y="346" width="116" height="13" rx="6.5" fill="#cbd5e1"/>
</svg>`;

const targets = [
  { file: "public/icon-192.png", size: 192, rounded: true },
  { file: "public/icon-512.png", size: 512, rounded: true },
  { file: "app/apple-icon.png", size: 180, rounded: false },
];

for (const t of targets) {
  await sharp(Buffer.from(svg(t.rounded))).resize(t.size, t.size).png().toFile(t.file);
  console.log("wrote", t.file);
}
