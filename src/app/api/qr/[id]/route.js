/**
 * GET /api/qr/:id
 * Returns a 1000×1000 PNG — a scannable QR code with a heart logo in the
 * centre, on a rose-branded card.
 *
 * Technique: "logo-in-QR" — the full rectangular QR is generated with
 * error-correction level H (recovers up to 30 % data loss).  A heart SVG
 * is composited over the centre (~14 % of area), which ECC H handles
 * easily.  All three finder-pattern corners remain untouched, so every
 * iPhone / Android camera app can decode it instantly.
 */

import QRCode from 'qrcode';
import sharp  from 'sharp';

export const dynamic = 'force-dynamic';

function xe(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

  // ── Step 1: QR code as PNG (dark red on white, ECC H) ────────────────────────
  const QR_PX = 580;
  let qrBuffer;
  try {
    qrBuffer = await QRCode.toBuffer(giftUrl, {
      errorCorrectionLevel: 'H',
      width:  QR_PX,
      margin: 3,
      color:  { dark: '#8b1a2f', light: '#ffffff' },  // deep rose-red on white
    });
  } catch {
    return new Response('QR generation failed', { status: 500 });
  }

  // ── Step 2: Heart overlay — centred on the QR ────────────────────────────────
  // Covers ≈ 14 % of QR area — well within ECC H's 30 % tolerance.
  // Finder patterns are at the three corners and are never touched.
  const H   = 200;                          // heart bounding box size (px)
  const W   = 200;
  const hLeft = Math.round((QR_PX - W) / 2);
  const hTop  = Math.round((QR_PX - H) / 2);

  // Normalised heart path scaled to W × H
  const p = (x, y) => `${(x * W).toFixed(1)},${(y * H).toFixed(1)}`;
  const heartPath = [
    `M ${p(0.5, 0.88)}`,
    `C ${p(0.5,  0.88)} ${p(0.05, 0.58)} ${p(0.05, 0.35)}`,
    `C ${p(0.05, 0.14)} ${p(0.20, 0.04)} ${p(0.34, 0.04)}`,
    `C ${p(0.42, 0.04)} ${p(0.50, 0.15)} ${p(0.50, 0.15)}`,
    `C ${p(0.50, 0.15)} ${p(0.58, 0.04)} ${p(0.66, 0.04)}`,
    `C ${p(0.80, 0.04)} ${p(0.95, 0.14)} ${p(0.95, 0.35)}`,
    `C ${p(0.95, 0.58)} ${p(0.5,  0.88)} ${p(0.5,  0.88)} Z`,
  ].join(' ');

  const heartSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- White backing so modules under the heart disappear cleanly -->
  <path d="${heartPath}" fill="white"/>
  <!-- Pink-red heart fill -->
  <path d="${heartPath}" fill="#e8405a"/>
  <!-- Lighter inner highlight -->
  <path d="${heartPath}" fill="url(#hg)" opacity="0.55"/>
  <defs>
    <radialGradient id="hg" cx="42%" cy="35%" r="55%">
      <stop offset="0%"   stop-color="#ff8fa3"/>
      <stop offset="100%" stop-color="#c0392b" stop-opacity="0"/>
    </radialGradient>
  </defs>
</svg>`;

  // Composite heart onto QR
  const qrWithHeart = await sharp(qrBuffer)
    .composite([{ input: Buffer.from(heartSvg), left: hLeft, top: hTop }])
    .png()
    .toBuffer();

  // ── Step 3: Decorative background SVG ────────────────────────────────────────
  const QR_LEFT = Math.round((1000 - QR_PX) / 2);
  const QR_TOP  = 230;

  const ctaY   = QR_TOP + QR_PX + 28;
  const labelY = ctaY + 40;
  const subY   = ctaY + 72;

  const bgHearts = [
    [60,60,28],[940,60,24],[60,940,24],[940,940,28],
    [500,42,18],[42,500,16],[958,500,16],[500,958,18],
    [160,160,14],[840,160,14],[160,840,14],[840,840,14],
    [310,85,11],[690,85,11],[85,310,11],[915,310,11],
    [85,690,11],[915,690,11],[310,915,11],[690,915,11],
  ].map(([cx,cy,sz]) => heartAt(cx,cy,sz,0.14)).join('\n  ');

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
  <rect width="1000" height="1000" fill="url(#bg)"/>
  ${bgHearts}
  <rect x="80" y="80" width="840" height="840" rx="36"
        fill="white" filter="url(#shadow)" stroke="#e57373" stroke-width="2" opacity="0.96"/>
  <rect x="80" y="80" width="840" height="6" rx="3" fill="#c0392b" opacity="0.65"/>
  ${heartAt(155, 155, 30, 0.5)}
  ${heartAt(845, 155, 30, 0.5)}
  <text x="500" y="180"
        font-family="Georgia,'Times New Roman',serif"
        font-size="52" font-style="italic"
        fill="#c0392b" text-anchor="middle" opacity="0.92" letter-spacing="3">i love you</text>
  <text x="500" y="216" font-family="serif" font-size="16"
        fill="#e57373" text-anchor="middle" opacity="0.45">· · · · ·</text>
  <!-- White base so QR sits on clean white -->
  <rect x="${QR_LEFT}" y="${QR_TOP}" width="${QR_PX}" height="${QR_PX}" fill="white"/>
  <text x="500" y="${ctaY - 4}"
        font-family="Georgia,'Times New Roman',serif"
        font-size="20" font-style="italic"
        fill="#c0392b" text-anchor="middle" opacity="0.65">Scan to open your gift</text>
  <rect x="210" y="${ctaY + 4}" width="580" height="54" rx="27" fill="#c0392b" opacity="0.9"/>
  <text x="500" y="${labelY}"
        font-family="Georgia,'Times New Roman',serif"
        font-size="22" font-weight="bold" font-style="italic"
        fill="white" text-anchor="middle" letter-spacing="1">Create your own gift</text>
  <text x="500" y="${subY}"
        font-family="Georgia,'Times New Roman',serif"
        font-size="17" letter-spacing="2"
        fill="#c0392b" text-anchor="middle" opacity="0.55">digitalgiftwithlove.com</text>
</svg>`;

  // ── Step 4: Composite QR-with-heart onto background ──────────────────────────
  const pngBuffer = await sharp(Buffer.from(bgSvg))
    .resize(1000, 1000)
    .composite([{ input: qrWithHeart, left: QR_LEFT, top: QR_TOP }])
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
