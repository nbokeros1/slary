// Run once: node scripts/gen-icons.mjs
// Generates public/icon-192.png and public/icon-512.png
// Requires: npm install --save-dev sharp

import sharp from 'sharp'
import { writeFileSync } from 'fs'

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#0F1117"/>
  <text
    x="50%" y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="900"
    font-size="${size * 0.42}"
    fill="#C8F135"
    letter-spacing="-${size * 0.02}"
  >S</text>
  <circle cx="${size * 0.72}" cy="${size * 0.28}" r="${size * 0.07}" fill="#C8F135"/>
</svg>
`

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).png().toFile(`public/icon-${size}.png`)
  console.log(`✓ public/icon-${size}.png`)
}
