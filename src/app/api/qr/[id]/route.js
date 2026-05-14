import QRCode from 'qrcode';
import sharp  from 'sharp';

export const dynamic = 'force-dynamic';

function xe(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Returns true if the normalised point (px, py) ∈ [-1,1]² is inside the heart.
// y-axis is flipped and shifted up slightly so the heart is centred vertically.
function insideHeart(px, py) {
  const x = px;
  const y = -py + 0.1;
  return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0;
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

  const size    = qr.modules.size;
  const modules = qr.modules.data;

  const CANVAS       = 1000;
  const modulePixels = CANVAS / size;
  const PADDING      = 0.08;

  // Debug: check all three finder pattern corners are inside the heart
  const finderCorners = [
    { label: 'top-left',     col: 3,          row: 3          },
    { label: 'top-right',    col: size - 4,   row: 3          },
    { label: 'bottom-left',  col: 3,          row: size - 4   },
  ];
  finderCorners.forEach(({ label, col, row }) => {
    const nx = ((col + 0.5) / size) * (2 - PADDING * 2) - (1 - PADDING);
    const ny = ((row + 0.5) / size) * (2 - PADDING * 2) - (1 - PADDING);
    console.log(`Finder pattern coverage: ${label} (${col},${row}) nx=${nx.toFixed(3)} ny=${ny.toFixed(3)} inside=${insideHeart(nx, ny)}`);
  });

  // Build SVG rects — pink for dark modules, white for light, nothing outside heart
  const rects = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const nx = ((col + 0.5) / size) * (2 - PADDING * 2) - (1 - PADDING);
      const ny = ((row + 0.5) / size) * (2 - PADDING * 2) - (1 - PADDING);

      if (!insideHeart(nx, ny)) continue;

      const isDark = modules[row * size + col];
      const fill   = isDark ? '#c8185a' : 'white';
      const x      = (col * modulePixels).toFixed(2);
      const y      = (row * modulePixels).toFixed(2);
      const s      = modulePixels.toFixed(2);
      rects.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fill}"/>`);
    }
  }

  const svg = `<svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="1000" fill="white"/>
  ${rects.join('\n  ')}
</svg>`;

  const png = await sharp(Buffer.from(svg))
    .resize(1000, 1000)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return new Response(png, {
    headers: {
      'Content-Type':  'image/png',
      'Cache-Control': 'public, max-age=300',
      'Content-Disposition': `inline; filename="love-qr-${xe(id)}.png"`,
    },
  });
}
