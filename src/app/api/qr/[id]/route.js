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

  const opts = { errorCorrectionLevel: 'H', margin: 1, color: { dark: '#c8185a', light: '#ffffff' } };

  // Two bump circles side-by-side span the same width as the main QR
  // so all three pieces align perfectly left-to-right.
  const CIRCLE_D = 280;   // diameter of each bump — two × this = main QR width
  const CIRCLE_R = 140;
  const MAIN_SZ  = 560;   // main scannable QR (2 × CIRCLE_D)
  const CANVAS   = 1000;

  const [mainBuf, bumpBuf] = await Promise.all([
    QRCode.toBuffer(giftUrl, { ...opts, width: MAIN_SZ }),
    QRCode.toBuffer(giftUrl, { ...opts, width: CIRCLE_D }),
  ]);

  // Circular mask: SVG rounded-rect with rx = ry = half size produces a perfect circle.
  // sharp's dest-in blend keeps destination pixels only where the mask is opaque (inside circle).
  const circleMask = Buffer.from(
    `<svg width="${CIRCLE_D}" height="${CIRCLE_D}">` +
    `<rect width="${CIRCLE_D}" height="${CIRCLE_D}" rx="${CIRCLE_R}" ry="${CIRCLE_R}"/>` +
    `</svg>`
  );

  const circularQR = await sharp(bumpBuf)
    .ensureAlpha()
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // ── Layout on 1000×1000 white canvas ────────────────────────────────────────
  //
  //   x=220        x=500       x=780
  //   [  circle  ][  circle  ]          y=60 … y=340  (circles, 280px tall)
  //   [     main QR 560×560  ]          y=320 … y=880  (20px overlap with circles)
  //
  // The two circles together are 560px wide, flush with the main QR on left and right.
  // The slight overlap hides the gap between circles and square → clean heart silhouette.

  const MAIN_LEFT  = (CANVAS - MAIN_SZ) / 2;       // 220
  const CIRC_TOP   = 60;
  const L_LEFT     = MAIN_LEFT;                     // 220
  const R_LEFT     = MAIN_LEFT + CIRCLE_D;          // 500
  const MAIN_TOP   = CIRC_TOP + CIRCLE_D - 20;      // 320

  const result = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: circularQR, left: L_LEFT,    top: CIRC_TOP },   // left bump
      { input: circularQR, left: R_LEFT,    top: CIRC_TOP },   // right bump
      { input: mainBuf,    left: MAIN_LEFT, top: MAIN_TOP  },  // scannable QR
    ])
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  return new Response(result, {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=300',
      'Content-Disposition': `inline; filename="love-qr-${xe(id)}.png"`,
    },
  });
}
