/**
 * GET /api/qr/:id
 * Produces a 1000×1000 PNG of a heart-shaped QR code.
 *
 * Technique: one full QR matrix (ECC H) is rendered as pink <rect> elements
 * inside an SVG.  A heart-shaped <clipPath> hides everything outside the
 * heart silhouette.  The clip is split into left/right lobes so SVG renderers
 * handle the intersection cleanly via nested clip groups.  sharp converts the
 * final SVG to PNG.
 */

import QRCode from 'qrcode';
import sharp  from 'sharp';

export const dynamic = 'force-dynamic';

function xe(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HEART =
  'M500,820 C500,820 80,560 80,300 C80,160 180,60 320,60 ' +
  'C400,60 460,110 500,160 C540,110 600,60 680,60 ' +
  'C820,60 920,160 920,300 C920,560 500,820 500,820Z';

export async function GET(request, { params }) {
  const { id } = await params;

  const origin = request.headers.get('x-forwarded-proto')
    ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
    : new URL(request.url).origin;
  const giftUrl = `${origin}/gift/${id}`;

  // ── 1. QR matrix ────────────────────────────────────────────────────────────
  let qr;
  try {
    qr = QRCode.create(giftUrl, { errorCorrectionLevel: 'H' });
  } catch {
    return new Response('QR generation failed', { status: 500 });
  }

  const size = qr.modules.size;
  const data = qr.modules.data;

  // ── 2. Layout ────────────────────────────────────────────────────────────────
  // Use 780/size so the QR grid fits comfortably inside the heart's bounding
  // box (heart spans roughly x 80–920, y 60–820 on the 1000×1000 canvas).
  const moduleSize = 780 / size;
  const offsetX    = (1000 - size * moduleSize) / 2;
  const offsetY    = (1000 - size * moduleSize) / 2 + 20;

  // ── 3. Build rect list ───────────────────────────────────────────────────────
  const rects = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!data[row * size + col]) continue;
      const x = (offsetX + col * moduleSize).toFixed(2);
      const y = (offsetY + row * moduleSize).toFixed(2);
      const s = moduleSize.toFixed(2);
      rects.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`);
    }
  }
  const rectsStr = rects.join('');

  // ── 4. SVG — two nested clip groups give heart ∩ left-half and heart ∩ right-half
  const svg = `<svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="heart"><path d="${HEART}"/></clipPath>
    <clipPath id="lh"><rect x="0"   y="0" width="500"  height="1000"/></clipPath>
    <clipPath id="rh"><rect x="500" y="0" width="500"  height="1000"/></clipPath>
  </defs>
  <rect width="1000" height="1000" fill="white"/>
  <g fill="#c8185a">
    <g clip-path="url(#heart)"><g clip-path="url(#lh)">${rectsStr}</g></g>
    <g clip-path="url(#heart)"><g clip-path="url(#rh)">${rectsStr}</g></g>
  </g>
</svg>`;

  // ── 5. SVG → PNG ─────────────────────────────────────────────────────────────
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(1000, 1000)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  return new Response(pngBuffer, {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=300',
      'Content-Disposition': `inline; filename="love-qr-${xe(id)}.png"`,
    },
  });
}
