/**
 * GET /api/og/:id
 * Returns a 1200×630 SVG preview card for Open Graph / link previews.
 * Used by WhatsApp, iMessage, Telegram, etc. when a gift link is shared.
 */

import { getGift } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** XML-escape a string so it's safe inside SVG text/attr nodes */
function xe(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Split a long title into at most 2 display lines.
 * Tries to break on word boundaries; each line ≤ maxLen chars.
 */
function splitTitle(text, maxLen = 28) {
  if (text.length <= maxLen) return [text, ''];
  const words = text.split(' ');
  let line1 = '', line2 = '';
  for (const w of words) {
    const candidate = line1 ? `${line1} ${w}` : w;
    if (!line1 || candidate.length <= maxLen) {
      line1 = candidate;
    } else {
      line2 = line2 ? `${line2} ${w}` : w;
    }
  }
  if (line2.length > maxLen + 5) line2 = line2.slice(0, maxLen + 2) + '…';
  return [line1, line2];
}

/** 20 small decorative hearts scattered around the canvas */
function scatteredHearts() {
  const positions = [
    [80,  60,  18, 0.18], [200, 110, 12, 0.12], [350,  40, 16, 0.15],
    [520,  80, 10, 0.10], [720,  55, 14, 0.13], [900,  90, 11, 0.11],
    [1060, 50, 17, 0.16], [1140,130, 13, 0.12], [60,  200, 11, 0.10],
    [1150,280, 15, 0.14], [50,  420, 14, 0.12], [1145,420, 12, 0.11],
    [100, 540, 16, 0.15], [300, 580, 11, 0.10], [600, 600, 13, 0.10],
    [850, 575, 14, 0.12], [1060,545, 12, 0.11], [1140,460, 10, 0.09],
    [160, 320, 10, 0.09], [1040,320, 11, 0.10],
  ];
  // Heart path in a ~20×18 unit local space, centred at (10, 11)
  const hp = 'M10 16 C10 16 1 10 1 5 C1 2.5 3.5 1 6 1 C7.5 1 9 2 10 3.2 C11 2 12.5 1 14 1 C16.5 1 19 2.5 19 5 C19 10 10 16 10 16Z';
  return positions.map(([cx, cy, sz, op]) => {
    const s  = sz / 20;
    const tx = cx - 10 * s;
    const ty = cy - 11 * s;
    return `<path d="${hp}" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${s.toFixed(3)})" fill="#c96a7a" opacity="${op}"/>`;
  }).join('\n  ');
}

export async function GET(request, { params }) {
  const { id } = await params;

  let title      = 'A Digital Love Gift';
  let name       = 'You';
  let occasion   = '';

  try {
    const gift = await getGift(id);
    if (gift) {
      title    = gift.content?.title      || title;
      name     = gift.formData?.partnerName || name;
      occasion = gift.formData?.occasion   || '';
    }
  } catch { /* fall through to generic card */ }

  const [line1, line2] = splitTitle(xe(title));
  const safeName       = xe(name);
  const safeOccasion   = xe(occasion);

  // Title layout: shift up if only one line, down if two
  const titleY1 = line2 ? 348 : 370;
  const titleY2 = titleY1 + 68;
  const nameY   = line2 ? titleY2 + 72 : titleY1 + 72;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#fdf8f3"/>
      <stop offset="50%"  stop-color="#faedf2"/>
      <stop offset="100%" stop-color="#fce4ec"/>
    </linearGradient>
    <linearGradient id="heartFill" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%"   stop-color="#f9cfd8"/>
      <stop offset="100%" stop-color="#c96a7a"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#c96a7a" flood-opacity="0.22"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Scattered decorative hearts -->
  ${scatteredHearts()}

  <!-- Outer border frame -->
  <rect x="18" y="18" width="1164" height="594" rx="20" fill="none" stroke="#f0b4c2" stroke-width="2.5" opacity="0.7"/>
  <!-- Inner border frame -->
  <rect x="30" y="30" width="1140" height="570" rx="14" fill="none" stroke="#f8dce7" stroke-width="1" opacity="0.8"/>

  <!-- Top branding label -->
  <text x="600" y="72" font-family="Georgia, 'Times New Roman', serif" font-size="19"
        fill="#c96a7a" text-anchor="middle" letter-spacing="5" opacity="0.75">
    ✦  DIGITAL LOVE GIFT  ✦
  </text>

  <!-- Occasion badge (if present) -->
  ${safeOccasion ? `
  <rect x="520" y="88" width="160" height="32" rx="16" fill="#f5c6d0" opacity="0.6"/>
  <text x="600" y="109" font-family="Georgia, serif" font-size="17"
        fill="#a0485a" text-anchor="middle" opacity="0.9">${safeOccasion}</text>` : ''}

  <!-- Big glowing heart — centred at (600, 220), ~190px wide -->
  <!-- Original path viewBox ~120×100; scale ≈ 1.58, translate to centre -->
  <g filter="url(#glow)">
    <path d="M60 95 C60 95 10 60 10 30 C10 15 22 5 35 5 C44 5 52 10 60 18 C68 10 76 5 85 5 C98 5 110 15 110 30 C110 60 60 95 60 95Z"
          transform="translate(505, 130) scale(1.585)"
          fill="url(#heartFill)" filter="url(#softShadow)"/>
  </g>

  <!-- Decorative divider dots above title -->
  <text x="600" y="${titleY1 - 28}" font-family="Georgia, serif" font-size="20"
        fill="#c96a7a" text-anchor="middle" opacity="0.5">· · ·</text>

  <!-- Gift title — italic serif, up to 2 lines -->
  <text x="600" y="${titleY1}" font-family="Georgia, 'Times New Roman', serif"
        font-size="58" fill="#7a2838" text-anchor="middle" font-style="italic"
        font-weight="400">${line1}</text>
  ${line2 ? `<text x="600" y="${titleY2}" font-family="Georgia, 'Times New Roman', serif"
        font-size="58" fill="#7a2838" text-anchor="middle" font-style="italic"
        font-weight="400">${line2}</text>` : ''}

  <!-- "For [name]" line -->
  <text x="600" y="${nameY}" font-family="Georgia, 'Times New Roman', serif"
        font-size="34" fill="#c96a7a" text-anchor="middle" font-style="italic">
    For ${safeName} 💝
  </text>

  <!-- Bottom divider -->
  <line x1="440" y1="565" x2="760" y2="565" stroke="#f0b4c2" stroke-width="1.5" opacity="0.7"/>

  <!-- Bottom tagline -->
  <text x="600" y="595" font-family="Georgia, 'Times New Roman', serif" font-size="18"
        fill="#c96a7a" text-anchor="middle" letter-spacing="2" opacity="0.65">
    Someone made this just for you
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type':  'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  });
}
