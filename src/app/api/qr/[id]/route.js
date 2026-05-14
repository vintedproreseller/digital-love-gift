import QRCode from 'qrcode';
import sharp  from 'sharp';

export const dynamic = 'force-dynamic';

function xe(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Returns SVG <rect> elements for every dark module in the QR matrix.
// Modules are rendered inside a 400×400 square starting at (0,0).
function qrRects(modules) {
  const size = modules.size;
  const m    = 400 / size;
  let out    = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules.data[r * size + c]) {
        out += `<rect x="${(c * m).toFixed(2)}" y="${(r * m).toFixed(2)}" width="${m.toFixed(2)}" height="${m.toFixed(2)}"/>`;
      }
    }
  }
  return out;
}

export async function GET(request, { params }) {
  const { id } = await params;

  const origin = request.headers.get('x-forwarded-proto')
    ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
    : new URL(request.url).origin;
  const giftUrl = `${origin}/gift/${id}`;

  let qr;
  try {
    qr = QRCode.create(giftUrl, { errorCorrectionLevel: 'H' });
  } catch {
    return new Response('QR generation failed', { status: 500 });
  }

  // Build the rect string once — reused for all three pieces.
  const rects = qrRects(qr.modules);

  // ── SVG layout (900×900 canvas) ─────────────────────────────────────────────
  //
  //  Two circle clips at (225,225) and (675,225) r=225 form the top bumps.
  //  The QR for each bump is rotated ±90° so it fills the circle visually.
  //
  //  The diamond is the same QR rotated 45°, centered at (450,536).
  //  y=536 is chosen so the diamond's top vertex lands at y≈225,
  //  exactly where the two circles meet — closing the heart at the center dip.
  //
  //  All three pieces are the same QR code (same URL, ECC H) in hot pink.
  //  Only the diamond is scannable; the bumps are decorative.

  const svg = `<svg width="900" height="900" viewBox="0 0 900 900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="lc"><ellipse cx="225" cy="225" rx="225" ry="225"/></clipPath>
    <clipPath id="rc"><ellipse cx="675" cy="225" rx="225" ry="225"/></clipPath>
  </defs>
  <rect width="900" height="900" fill="white"/>

  <!-- Left bump: QR rotated -90°, clipped to left circle -->
  <g clip-path="url(#lc)" fill="#c8185a">
    <g transform="translate(225,225) rotate(-90) translate(-200,-200)">
      ${rects}
    </g>
  </g>

  <!-- Right bump: QR rotated +90°, clipped to right circle -->
  <g clip-path="url(#rc)" fill="#c8185a">
    <g transform="translate(675,225) rotate(90) translate(-200,-200)">
      ${rects}
    </g>
  </g>

  <!-- Diamond: QR rotated 45° — the scannable piece -->
  <g fill="#c8185a">
    <g transform="translate(450,536) rotate(45) scale(1.1) translate(-200,-200)">
      ${rects}
    </g>
  </g>
</svg>`;

  const png = await sharp(Buffer.from(svg))
    .resize(1000, 1000)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
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
