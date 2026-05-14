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
  //  Left  circle: cx=225, cy=220, r=225  → right edge exactly at x=450
  //  Right circle: cx=675, cy=220, r=225  → left  edge exactly at x=450
  //  Both circles touch at (450, 220) — the center dip of the heart.
  //
  //  Diamond: QR rotated 45°, scale=0.78 so its width when rotated ≈ 440px
  //  (matching the combined width of the two bump circles).
  //  Half-diagonal = 200 × 0.78 × √2 ≈ 221px, so:
  //    top    vertex → y = 580 − 221 ≈ 359  (overlaps circle bottoms at y≈445)
  //    bottom vertex → y = 580 + 221 ≈ 801  (heart point)
  //    left/right    → x = 450 ± 221 → 229 … 671
  //
  //  The overlap between circles (bottom) and diamond (top) is all-pink so
  //  the pieces merge seamlessly with no white gap.

  const svg = `<svg width="900" height="900" viewBox="0 0 900 900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="lc"><circle cx="225" cy="220" r="225"/></clipPath>
    <clipPath id="rc"><circle cx="675" cy="220" r="225"/></clipPath>
  </defs>
  <rect width="900" height="900" fill="white"/>

  <!-- Left bump: QR rotated -90°, clipped to left circle (right edge at x=450) -->
  <g clip-path="url(#lc)" fill="#c8185a">
    <g transform="translate(225,220) rotate(-90) translate(-200,-200)">
      ${rects}
    </g>
  </g>

  <!-- Right bump: QR rotated +90°, clipped to right circle (left edge at x=450) -->
  <g clip-path="url(#rc)" fill="#c8185a">
    <g transform="translate(675,220) rotate(90) translate(-200,-200)">
      ${rects}
    </g>
  </g>

  <!-- Diamond: QR rotated 45°, scale 0.78 — the scannable piece -->
  <g fill="#c8185a">
    <g transform="translate(450,580) rotate(45) scale(0.78) translate(-200,-200)">
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
