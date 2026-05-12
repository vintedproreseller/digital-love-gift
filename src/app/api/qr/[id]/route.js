/**
 * GET /api/qr/:id
 * Returns a 1000×1000 PNG — a scannable QR code on a rose-branded card.
 *
 * Strategy: use the `qrcode` library to render the QR directly as a PNG
 * buffer (guaranteed correct, proper quiet zone), then composite it onto
 * a decorative SVG background using sharp.  This avoids librsvg mangling
 * the QR modules when converting SVG→PNG.
 */

import QRCode from 'qrcode';
import sharp  from 'sharp';

export const dynamic = 'force-dynamic';

function xe(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Tiny heart shape centred at (cx,cy) */
function heartAt(cx, cy, size, opacity = 0.15) {
  const s  = size / 20;
  const tx = (cx - 10 * s).toFixed(1);
  const ty = (cy - 11 * s).toFixed(1);
  return `<path d="M10 16 C10 16 1 10 1 5 C1 2.5 3.5 1 6 1 C7.5 1 9 2 10 3.2 C11 2 12.5 1 14 1 C16.5 1 19 2.5 19 5 C19 10 10 16 10 16Z" transform="translate(${tx},${ty}) scale(${s.toFixed(3)})" fill="#c0392b" opacity="${opacity}"/>`;
}

export async function GET(request, { params }) {
  const { id } = await params;

  const origin = request.headers.get('x-forwarded-proto')
    ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
    : new URL(request.url).origin;
  const giftUrl = `${origin}/gift/${id}`;

  // ── Step 1: QR code rendered directly to PNG by qrcode library ──────────────
  // This is the reliable path — qrcode handles all module placement,
  // finder patterns, and quiet zone correctly.
  const QR_PX = 580;
  let qrBuffer;
  try {
    qrBuffer = await QRCode.toBuffer(giftUrl, {
      errorCorrectionLevel: 'H',
      width:  QR_PX,
      margin: 4,                              // 4-module quiet zone (spec minimum)
      color:  { dark: '#000000', light: '#ffffff' },
    });
  } catch {
    return new Response('QR generation failed', { status: 500 });
  }

  // ── Step 2: Decorative background as SVG (no QR modules here) ───────────────
  const QR_LEFT = Math.round((1000 - QR_PX) / 2);  // 210 — horizontally centred
  const QR_TOP  = 230;                               // below header text

  const bgHearts = [
    [60,  60,  28],[940, 60,  24],[60,  940, 24],[940, 940, 28],
    [500, 42,  18],[42,  500, 16],[958, 500, 16],[500, 958, 18],
    [160, 160, 14],[840, 160, 14],[160, 840, 14],[840, 840, 14],
    [310, 85,  11],[690, 85,  11],[85,  310, 11],[915, 310, 11],
    [85,  690, 11],[915, 690, 11],[310, 915, 11],[690, 915, 11],
  ].map(([cx, cy, sz]) => heartAt(cx, cy, sz, 0.14)).join('\n  ');

  // CTA pill sits below the QR
  const ctaY    = QR_TOP + QR_PX + 30;   // 840
  const labelY  = ctaY + 42;             // 882 — text baseline inside pill
  const subY    = ctaY + 74;             // 914 — domain text below pill

  const bgSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1000" height="1000" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#fff5f8"/>
      <stop offset="50%"  stop-color="#fce4ec"/>
      <stop offset="100%" stop-color="#fad4e0"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="16" flood-color="#c0392b" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1000" height="1000" fill="url(#bg)"/>

  <!-- Scattered hearts -->
  ${bgHearts}

  <!-- White card -->
  <rect x="80" y="80" width="840" height="840" rx="36"
        fill="white" filter="url(#shadow)" stroke="#e57373" stroke-width="2" opacity="0.96"/>

  <!-- Card top accent -->
  <rect x="80" y="80" width="840" height="6" rx="3" fill="#c0392b" opacity="0.65"/>

  <!-- Corner hearts on card -->
  ${heartAt(155, 155, 30, 0.5)}
  ${heartAt(845, 155, 30, 0.5)}

  <!-- "i love you" header -->
  <text x="500" y="180"
        font-family="Georgia,'Times New Roman',serif"
        font-size="52" font-style="italic"
        fill="#c0392b" text-anchor="middle" opacity="0.92" letter-spacing="3">i love you</text>

  <!-- Divider -->
  <text x="500" y="216" font-family="serif" font-size="16"
        fill="#e57373" text-anchor="middle" opacity="0.45">· · · · ·</text>

  <!-- White base for QR (sharp will composite the actual QR PNG here) -->
  <rect x="${QR_LEFT}" y="${QR_TOP}" width="${QR_PX}" height="${QR_PX}" fill="white"/>

  <!-- "Scan to open your gift" -->
  <text x="500" y="${ctaY - 4}"
        font-family="Georgia,'Times New Roman',serif"
        font-size="20" font-style="italic"
        fill="#c0392b" text-anchor="middle" opacity="0.65">Scan to open your gift</text>

  <!-- CTA pill -->
  <rect x="210" y="${ctaY + 4}" width="580" height="54" rx="27"
        fill="#c0392b" opacity="0.9"/>
  <text x="500" y="${labelY}"
        font-family="Georgia,'Times New Roman',serif"
        font-size="22" font-weight="bold" font-style="italic"
        fill="white" text-anchor="middle" letter-spacing="1">Create your own gift</text>

  <!-- Domain below pill -->
  <text x="500" y="${subY}"
        font-family="Georgia,'Times New Roman',serif"
        font-size="17" letter-spacing="2"
        fill="#c0392b" text-anchor="middle" opacity="0.55">digitalgiftwithlove.com</text>
</svg>`;

  // ── Step 3: Rasterise background, then composite QR PNG on top ──────────────
  const pngBuffer = await sharp(Buffer.from(bgSvg))
    .resize(1000, 1000)
    .composite([{ input: qrBuffer, left: QR_LEFT, top: QR_TOP }])
    .png()
    .toBuffer();

  return new Response(pngBuffer, {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      'Content-Disposition': `inline; filename="love-qr-${xe(id)}.png"`,
    },
  });
}
