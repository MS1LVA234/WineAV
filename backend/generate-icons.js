const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '../frontend/icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Wine glass SVG icon with dark wine background
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Background circle -->
  <rect width="512" height="512" rx="100" fill="#7B2D3E"/>
  <!-- Wine glass body -->
  <path d="M180 80 L332 80 L290 240 Q260 310 256 340 L256 390 L210 390 L210 420 L302 420 L302 390 L256 390" 
        fill="none" stroke="none"/>
  <!-- Simplified wine glass shape -->
  <path d="M175 90 L337 90 L300 200 Q290 240 256 260 Q222 240 212 200 Z" 
        fill="#C9A84C" opacity="0.9"/>
  <!-- Wine in glass -->
  <path d="M218 165 L294 165 L280 200 Q268 225 256 232 Q244 225 232 200 Z" 
        fill="#5a1f2d"/>
  <!-- Stem -->
  <rect x="248" y="260" width="16" height="110" fill="#C9A84C" opacity="0.9"/>
  <!-- Base -->
  <rect x="195" y="370" width="122" height="18" rx="9" fill="#C9A84C" opacity="0.9"/>
  <!-- AV text -->
  <text x="256" y="460" font-family="Arial Black, sans-serif" font-size="52" font-weight="900"
        text-anchor="middle" fill="white" letter-spacing="2">AV</text>
</svg>`;

async function generate() {
  const svgBuf = Buffer.from(svgIcon);
  await sharp(svgBuf).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'));
  console.log('Generated icon-192.png');
  await sharp(svgBuf).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'));
  console.log('Generated icon-512.png');
  // Apple touch icon (180x180)
  await sharp(svgBuf).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');
}

generate().catch(console.error);
