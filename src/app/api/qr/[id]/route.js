/**
 * GET /api/qr/:id
 * Heart-shaped QR code: modules that fall outside the heart are omitted,
 * giving the whole QR the silhouette of a heart.
 *
 * ECC level H tolerates up to 30 % data loss, so clipping ~10-15 % of
 * edge modules is safe.  All three finder-pattern corners sit within the
 * algebraic heart at the normalised positions they occupy.
 */

import QRCode from 'qrcode';
import sharp  from 'sharp';

export const dynamic = 'force-dynamic';

function xe(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Algebraic heart: (x²+y²−1)³ − x²y³ ≤ 0
 * nx, ny  normalised to [−1, 1] with (0,0) = image centre.
 * We flip ny so the image top row maps to the bumps of the heart.
 */
function isInHeart(nx, ny) {
  const x = nx;
  const y = -ny;
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0.04; // tiny tolerance for edge modules
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
  const PAD = 40;                     // whitespace around the heart
  const area = IMG - PAD * 2;
  const m = area / size;              // px per module

  const rects = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!data[row * size + col]) continue;

      // Centre of this module in [−1, 1] space
      const nx = ((col + 0.5) / size) * 2 - 1;
      const ny = ((row + 0.5) / size) * 2 - 1;
      if (!isInHeart(nx, ny)) continue;

      const x = (PAD + col * m).toFixed(2);
      const y = (PAD + row * m).toFixed(2);
      const s = m.toFixed(2);
      rects.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`);
    }
  }

  // Single fill on a <g> keeps SVG small
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
