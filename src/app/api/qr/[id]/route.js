/**
 * GET /api/qr/:id
 * Heart-shaped QR code.  Modules outside the heart are hidden EXCEPT for
 * the three finder-pattern zones (top-left, top-right, bottom-left) which
 * are always rendered — cameras need all three to locate and decode the code.
 * ECC H (30 % loss tolerance) covers the remaining edge modules that get clipped.
 */

import QRCode from 'qrcode';
import sharp  from 'sharp';

export const dynamic = 'force-dynamic';

function xe(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Algebraic heart curve: inside when (x²+y²−1)³ − x²y³ ≤ 0
// nx, ny in [−1, 1]; ny flipped so image-top maps to heart bumps.
function isInHeart(nx, ny) {
  const x = nx;
  const y = -ny;
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0.02;
}

// Finder patterns + their separator rows/cols (rows/cols 0-8 around each corner).
// Cameras MUST see all three to decode the QR — never clip these.
function isFinderZone(row, col, size) {
  return (row <= 8 && col <= 8) ||           // top-left
         (row <= 8 && col >= size - 8) ||    // top-right
         (row >= size - 8 && col <= 8);      // bottom-left
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

  const size = qr.modules.size;
  const data = qr.modules.data;

  const IMG = 900;
  const PAD = 40;
  const area = IMG - PAD * 2;
  const m = area / size;   // px per module

  const rects = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!data[row * size + col]) continue;   // light module — skip

      const nx = ((col + 0.5) / size) * 2 - 1;
      const ny = ((row + 0.5) / size) * 2 - 1;

      // Keep if inside heart OR inside a finder-pattern zone
      if (!isInHeart(nx, ny) && !isFinderZone(row, col, size)) continue;

      const x = (PAD + col * m).toFixed(2);
      const y = (PAD + row * m).toFixed(2);
      const s = m.toFixed(2);
      rects.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`);
    }
  }

  const svg = `<svg width="${IMG}" height="${IMG}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${IMG}" height="${IMG}" fill="white"/>
  <g fill="#c8185a">
    ${rects.join('\n    ')}
  </g>
</svg>`;

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(pngBuffer, {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      'Content-Disposition': `inline; filename="love-qr-${xe(id)}.png"`,
    },
  });
}
