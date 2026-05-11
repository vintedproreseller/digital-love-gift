/**
 * GET /api/qr/:id
 * Returns a 1000×1000 PNG with the gift URL encoded as a heart-shaped QR code.
 * Modules outside the heart silhouette are omitted; ECC level M tolerates
 * the partial finder-pattern clipping that inevitably occurs at the bottom.
 * SVG is built first then rasterised with sharp so the result is shareable
 * on Instagram, WhatsApp, etc.
 */

import QRCode from 'qrcode';
import sharp  from 'sharp';
import { getGift } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─── Heart polygon ────────────────────────────────────────────────────────────
// Six cubic Bézier curves that trace a heart centred at x=500.
// Y range 130–880 leaves room for the "i love you" header above.
const HEART_CURVES = [
  // [p0x,p0y, cp1x,cp1y, cp2x,cp2y, p1x,p1y]
  [500, 880,  100, 630,  100, 380,  100, 380],
  [100, 380,  100, 230,  200, 130,  350, 130],
  [350, 130,  430, 130,  500, 200,  500, 200],
  [500, 200,  570, 130,  650, 130,  650, 130],
  [650, 130,  800, 130,  900, 230,  900, 380],
  [900, 380,  900, 630,  500, 880,  500, 880],
];

/** Cubic Bézier point at parameter t */
function cubicBezierPoint(p0, cp1, cp2, p1, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * cp1[0] + 3 * u * t * t * cp2[0] + t * t * t * p1[0],
    u * u * u * p0[1] + 3 * u * u * t * cp1[1] + 3 * u * t * t * cp2[1] + t * t * t * p1[1],
  ];
}

/** Build a polygon approximation of the heart (40 steps per Bézier segment) */
function buildHeartPolygon() {
  const pts = [];
  const STEPS = 40;
  for (const [p0x, p0y, cp1x, cp1y, cp2x, cp2y, p1x, p1y] of HEART_CURVES) {
    for (let i = 0; i < STEPS; i++) {
      pts.push(cubicBezierPoint([p0x, p0y], [cp1x, cp1y], [cp2x, cp2y], [p1x, p1y], i / STEPS));
    }
  }
  return pts;
}

/** Ray-casting point-in-polygon test */
function pointInPolygon(px, py, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── SVG helpers ─────────────────────────────────────────────────────────────
function xe(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(request, { params }) {
  const { id } = await params;

  // Build the URL to encode
  const origin = request.headers.get('x-forwarded-proto')
    ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
    : new URL(request.url).origin;
  const giftUrl = `${origin}/gift/${id}`;

  // Generate QR data
  let qrData;
  try {
    qrData = QRCode.create(giftUrl, { errorCorrectionLevel: 'M' });
  } catch (err) {
    return new Response('QR generation failed', { status: 500 });
  }

  const n        = qrData.modules.size;
  const modules  = qrData.modules.data;
  const cellSize = 750 / n;
  const gridX    = 500 - (n * cellSize) / 2;   // horizontally centred
  const gridY    = 130;                          // top of heart

  const heartPolygon = buildHeartPolygon();

  // Build dark-module rectangles that fall inside the heart
  const rects = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!modules[row * n + col]) continue; // light module
      const cx = gridX + col * cellSize + cellSize / 2;
      const cy = gridY + row * cellSize + cellSize / 2;
      if (!pointInPolygon(cx, cy, heartPolygon)) continue;
      const x = (gridX + col * cellSize).toFixed(2);
      const y = (gridY + row * cellSize).toFixed(2);
      const s = (cellSize + 0.5).toFixed(2); // tiny bleed to avoid gaps
      rects.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`);
    }
  }

  // Heart SVG path (same control points as polygon)
  const heartPath = 'M 500,880 C 100,630 100,380 100,380 C 100,230 200,130 350,130 C 430,130 500,200 500,200 C 500,200 570,130 650,130 C 800,130 900,230 900,380 C 900,380 900,630 500,880 Z';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1000" height="1000" viewBox="0 0 1000 1000"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Sacramento&amp;display=swap');
    </style>
    <linearGradient id="heartBg" x1="0%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%"   stop-color="#fce4ec"/>
      <stop offset="100%" stop-color="#f8bbd0"/>
    </linearGradient>
  </defs>

  <!-- White background -->
  <rect width="1000" height="1000" fill="#ffffff"/>

  <!-- "i love you" header -->
  <text x="500" y="72" font-family="Sacramento, cursive" font-size="72"
        fill="#c0392b" text-anchor="middle" opacity="0.9">i love you</text>

  <!-- Small heart icon below text -->
  <path d="M500,118 C500,118 488,108 488,100 C488,95 492,92 496,92 C498,92 500,94 500,94 C500,94 502,92 504,92 C508,92 512,95 512,100 C512,108 500,118 500,118Z"
        fill="#c0392b" opacity="0.7"/>

  <!-- Heart outline (subtle background fill) -->
  <path d="${xe(heartPath)}" fill="url(#heartBg)" opacity="0.25"/>

  <!-- QR modules clipped to heart shape -->
  <g fill="#c0392b">
    ${rects.join('\n    ')}
  </g>

  <!-- Heart outline stroke -->
  <path d="${xe(heartPath)}" fill="none" stroke="#c0392b" stroke-width="3" opacity="0.35"/>

  <!-- Footer -->
  <text x="500" y="960" font-family="Georgia, serif" font-size="22"
        fill="#c0392b" text-anchor="middle" letter-spacing="2" opacity="0.6">
    digitalgiftwithlove.com
  </text>
</svg>`;

  // Rasterise SVG → PNG at 2× for crisp Instagram/WhatsApp sharing
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(1000, 1000)
    .png()
    .toBuffer();

  return new Response(pngBuffer, {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'Content-Disposition': `inline; filename="love-qr-${id}.png"`,
    },
  });
}
