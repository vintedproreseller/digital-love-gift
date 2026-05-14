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

  const qrOpts = { errorCorrectionLevel: 'H', margin: 1, color: { dark: '#c8185a', light: '#ffffff' } };

  // Generate three QR buffers for the same URL
  const [mainBuf, bumpBuf] = await Promise.all([
    QRCode.toBuffer(giftUrl, { ...qrOpts, width: 560 }),
    QRCode.toBuffer(giftUrl, { ...qrOpts, width: 480 }),
  ]);

  // Bump radius = half the bump QR width
  const BUMP  = 240;   // half of 480
  const BUMP_FULL = 480;

  // Left bump  = left  half of bumpBuf (cols 0..239)
  // Right bump = right half of bumpBuf (cols 240..479)
  const [leftHalf, rightHalf] = await Promise.all([
    sharp(bumpBuf).extract({ left: 0,    top: 0, width: BUMP, height: BUMP_FULL }).toBuffer(),
    sharp(bumpBuf).extract({ left: BUMP, top: 0, width: BUMP, height: BUMP_FULL }).toBuffer(),
  ]);

  // ── Layout ──────────────────────────────────────────────────────────────────
  // Canvas: 1000 × 1000 white
  // Two bumps sit on top, touching at x = 500.
  // Main 560×560 QR below, centered, slightly overlapping the bumps.
  //
  //   left bump  right bump
  //    x=260        x=500       (each 240 px wide, so right edge of left = 500)
  //    y=40         y=40        top of bumps
  //
  //   main QR
  //    x=220  y=380             centered: (1000-560)/2 = 220
  //                             top of main overlaps bottom of bumps

  const BUMP_LEFT  = 260;   // left edge of left bump  → right edge = 260+240 = 500
  const BUMP_RIGHT = 500;   // left edge of right bump → right edge = 500+240 = 740
  const BUMP_TOP   = 40;
  const MAIN_LEFT  = 220;   // (1000-560)/2
  const MAIN_TOP   = 380;

  const result = await sharp({
    create: { width: 1000, height: 1000, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: leftHalf,  left: BUMP_LEFT,  top: BUMP_TOP },
      { input: rightHalf, left: BUMP_RIGHT, top: BUMP_TOP },
      { input: mainBuf,   left: MAIN_LEFT,  top: MAIN_TOP },
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
