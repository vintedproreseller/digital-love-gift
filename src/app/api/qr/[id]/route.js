/**
 * GET /api/qr/:id
 * Generates a clean square QR code (dark maroon on white, ECC H)
 * with a glossy pink heart composited in the centre.
 * The heart covers ~14% of area — well within ECC H's 30% recovery budget.
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

  // ── 1. QR code as PNG ────────────────────────────────────────────────────────
  let qrBuf;
  try {
    qrBuf = await QRCode.toBuffer(giftUrl, {
      errorCorrectionLevel: 'H',
      width:  600,
      margin: 2,
      color:  { dark: '#8b1a2f', light: '#ffffff' },
    });
  } catch {
    return new Response('QR generation failed', { status: 500 });
  }

  // ── 2. Glossy heart SVG ──────────────────────────────────────────────────────
  // Heart path drawn on a 200×200 canvas, tip at bottom-centre.
  const W = 200, H = 190;
  const heart =
    `M100,170 C100,170 10,115 10,68 C10,32 35,10 62,10 ` +
    `C78,10 92,22 100,34 C108,22 122,10 138,10 ` +
    `C165,10 190,32 190,68 C190,115 100,170 100,170Z`;

  const heartSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="body" cx="42%" cy="35%" r="58%">
      <stop offset="0%"   stop-color="#ff9eb5"/>
      <stop offset="45%"  stop-color="#f0506e"/>
      <stop offset="100%" stop-color="#c0183e"/>
    </radialGradient>
    <radialGradient id="shine" cx="36%" cy="28%" r="32%">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${heart}" fill="url(#body)"/>
  <path d="${heart}" fill="url(#shine)"/>
</svg>`;

  // ── 3. Composite heart centred on QR ────────────────────────────────────────
  const qrSize  = 600;
  const heartLeft = Math.round((qrSize - W) / 2);
  const heartTop  = Math.round((qrSize - H) / 2);

  const png = await sharp(qrBuf)
    .composite([{ input: Buffer.from(heartSvg), left: heartLeft, top: heartTop }])
    .png()
    .toBuffer();

  return new Response(png, {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=300',
      'Content-Disposition': `inline; filename="love-qr-${xe(id)}.png"`,
    },
  });
}
