/**
 * GET /api/qr/:id
 * Returns a 1000×1000 PNG — a fully scannable QR code styled in a romantic
 * rose card with heart decorations. All QR modules are kept intact so
 * iPhone / Android camera apps can reliably decode it.
 */

import QRCode from 'qrcode';
import sharp  from 'sharp';

export const dynamic = 'force-dynamic';

function xe(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Small heart path centred at (cx, cy) with given size */
function heartAt(cx, cy, size, opacity = 0.18) {
  const s = size / 20;
  const tx = (cx - 10 * s).toFixed(1);
  const ty = (cy - 11 * s).toFixed(1);
  return `<path d="M10 16 C10 16 1 10 1 5 C1 2.5 3.5 1 6 1 C7.5 1 9 2 10 3.2 C11 2 12.5 1 14 1 C16.5 1 19 2.5 19 5 C19 10 10 16 10 16Z"
    transform="translate(${tx},${ty}) scale(${s.toFixed(3)})"
    fill="#c0392b" opacity="${opacity}"/>`;
}

export async function GET(request, { params }) {
  const { id } = await params;

  const origin = request.headers.get('x-forwarded-proto')
    ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
    : new URL(request.url).origin;
  const giftUrl = `${origin}/gift/${id}`;

  // ── Generate QR module data ───────────────────────────────────
  let qrData;
  try {
    qrData = QRCode.create(giftUrl, { errorCorrectionLevel: 'H' });
  } catch {
    return new Response('QR generation failed', { status: 500 });
  }

  const n        = qrData.modules.size;
  const modules  = qrData.modules.data;

  // QR grid occupies a 620×620 area centred in the card (x:190–810, y:230–850)
  const QR_SIZE  = 620;
  const gridX    = 500 - QR_SIZE / 2;   // 190
  const gridY    = 230;
  const cellSize = QR_SIZE / n;

  // Build ALL dark modules as slightly-rounded rose rectangles
  const rects = [];
  const r = Math.max(1, (cellSize * 0.18).toFixed(2)); // corner radius
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!modules[row * n + col]) continue;
      const x = (gridX + col * cellSize).toFixed(2);
      const y = (gridY + row * cellSize).toFixed(2);
      const s = (cellSize - 0.4).toFixed(2); // tiny gap between modules
      rects.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}"/>`);
    }
  }

  // ── Decorative hearts scattered around the background ─────────
  const bgHearts = [
    [60,  60,  28], [940, 60,  22], [60,  940, 22], [940, 940, 28],
    [500, 40,  18], [40,  500, 16], [960, 500, 16], [500, 960, 18],
    [150, 150, 14], [850, 150, 14], [150, 850, 14], [850, 850, 14],
    [300, 80,  12], [700, 80,  12], [80,  300, 12], [920, 300, 12],
    [80,  700, 12], [920, 700, 12], [300, 920, 12], [700, 920, 12],
  ].map(([cx, cy, sz]) => heartAt(cx, cy, sz, 0.15)).join('\n  ');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1000" height="1000" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#fff5f8"/>
      <stop offset="50%"  stop-color="#fce4ec"/>
      <stop offset="100%" stop-color="#fad4e0"/>
    </linearGradient>
    <linearGradient id="cardStroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#f48fb1"/>
      <stop offset="100%" stop-color="#c0392b"/>
    </linearGradient>
    <filter id="cardShadow">
      <feDropShadow dx="0" dy="4" stdDeviation="18" flood-color="#c0392b" flood-opacity="0.13"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1000" height="1000" fill="url(#bg)"/>

  <!-- Scattered background hearts -->
  ${bgHearts}

  <!-- White card -->
  <rect x="80" y="80" width="840" height="840" rx="36"
        fill="white" filter="url(#cardShadow)"
        stroke="url(#cardStroke)" stroke-width="2.5" opacity="0.95"/>

  <!-- Card top accent line -->
  <rect x="80" y="80" width="840" height="6" rx="3" fill="url(#cardStroke)" opacity="0.7"/>

  <!-- Header hearts -->
  ${heartAt(160, 155, 32, 0.55)}
  ${heartAt(840, 155, 32, 0.55)}

  <!-- "i love you" header -->
  <text x="500" y="178"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="52" font-style="italic" font-weight="400"
        fill="#c0392b" text-anchor="middle" opacity="0.92"
        letter-spacing="3">i love you</text>

  <!-- Divider dots -->
  <text x="500" y="215" font-family="serif" font-size="18"
        fill="#e57373" text-anchor="middle" opacity="0.5">· · · · ·</text>

  <!-- QR code — ALL modules intact, rose coloured -->
  <rect x="${gridX - 8}" y="${gridY - 8}" width="${QR_SIZE + 16}" height="${QR_SIZE + 16}"
        fill="white" rx="4"/>
  <g fill="#c0392b">
    ${rects.join('\n    ')}
  </g>

  <!-- "Scan to open your gift" label -->
  <text x="500" y="${gridY + QR_SIZE + 34}"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="22" font-style="italic"
        fill="#c0392b" text-anchor="middle" opacity="0.7">
    Scan to open your gift 💝
  </text>

  <!-- Footer -->
  <text x="500" y="945"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="19" letter-spacing="2"
        fill="#c0392b" text-anchor="middle" opacity="0.5">
    digitalgiftwithlove.com
  </text>
</svg>`;

  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(1000, 1000)
    .png()
    .toBuffer();

  return new Response(pngBuffer, {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'Content-Disposition': `inline; filename="love-qr-${xe(id)}.png"`,
    },
  });
}
