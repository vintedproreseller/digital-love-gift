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
  const H   = 200;
  const W   = 200;
  const hLeft = Math.round((QR_PX - W) / 2);
  const hTop  = Math.round((QR_PX - H) / 2);

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
  <defs>
    <radialGradient id="hg" cx="42%" cy="35%" r="55%">
      <stop offset="0%"   stop-color="#ff8fa3"/>
      <stop offset="100%" stop-color="#c0392b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${heartPath}" fill="white"/>
  <path d="${heartPath}" fill="#e8405a"/>
  <path d="${heartPath}" fill="url(#hg)" opacity="0.55"/>
</svg>`;

  // ── Step 3: Composite heart onto QR — that's the final image ─────────────────
  const pngBuffer = await sharp(qrBuffer)
    .composite([{ input: Buffer.from(heartSvg), left: hLeft, top: hTop }])
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
