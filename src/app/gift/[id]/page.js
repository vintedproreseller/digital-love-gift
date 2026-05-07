/**
 * /gift/[id] — canonical shareable URL for each gift.
 *
 * How it works for link previews:
 *   • generateMetadata() runs server-side → injects OG/Twitter meta tags
 *     into <head> before any HTML is sent.
 *   • Crawlers (WhatsApp, iMessage, Telegram, Twitter bots) read only
 *     the initial HTML and see those meta tags → beautiful preview card.
 *   • Real users hit the page → inline <script> immediately redirects
 *     them to /gift.html?id=[id] where the full interactive experience lives.
 *
 * This keeps the full gift viewer in plain HTML/JS while still giving
 * every shareable link a proper server-rendered OG preview.
 */

import { getGift } from '@/lib/db';

/** Resolve the canonical base URL in all environments */
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL)           return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function generateMetadata({ params }) {
  const { id }  = await params;
  const baseUrl = getBaseUrl();

  let giftTitle  = 'A Digital Love Gift 💝';
  let giftName   = 'You';
  let occasion   = '';

  try {
    const gift = await getGift(id);
    if (gift) {
      giftTitle = gift.content?.title          || giftTitle;
      giftName  = gift.formData?.partnerName   || giftName;
      occasion  = gift.formData?.occasion      || '';
    }
  } catch { /* show generic meta if DB is unreachable */ }

  const ogTitle       = `A gift for ${giftName} 💝`;
  const ogDescription = occasion
    ? `A personal ${occasion} gift created just for ${giftName}. Open to see something beautiful.`
    : `Someone created something beautiful just for ${giftName}. Open to see your gift.`;
  const ogImage       = `${baseUrl}/api/og/${id}`;
  const ogUrl         = `${baseUrl}/gift/${id}`;

  return {
    title:       ogTitle,
    description: ogDescription,
    openGraph: {
      title:       ogTitle,
      description: ogDescription,
      url:         ogUrl,
      type:        'website',
      images: [{
        url:    ogImage,
        width:  1200,
        height: 630,
        alt:    `Gift for ${giftName}`,
      }],
    },
    twitter: {
      card:        'summary_large_image',
      title:       ogTitle,
      description: ogDescription,
      images:      [ogImage],
    },
  };
}

/**
 * The page component itself just redirects users to the real gift viewer.
 * We use an inline <script> so the redirect is instant for users,
 * while crawlers (which don't run JS) see the OG tags above.
 */
export default async function GiftPage({ params }) {
  const { id } = await params;

  // Sanitise id — only allow UUID-shaped strings into the redirect
  const safeId = /^[0-9a-f-]{36}$/i.test(id) ? id : '';

  return (
    <>
      {/* Instant JS redirect for human visitors */}
      {safeId && (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.location.replace('/gift.html?id=${safeId}');`,
          }}
        />
      )}

      {/* Fallback visible to crawlers / no-JS users */}
      <div style={{
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        height:          '100vh',
        background:      'linear-gradient(135deg, #fdf8f3 0%, #fce4ec 100%)',
        fontFamily:      "Georgia, 'Times New Roman', serif",
        color:           '#a0485a',
        textAlign:       'center',
        gap:             '16px',
      }}>
        <div style={{ fontSize: '4rem' }}>💝</div>
        <div style={{ fontSize: '1.6rem', fontStyle: 'italic' }}>
          Opening your gift…
        </div>
        <a
          href={safeId ? `/gift.html?id=${safeId}` : '/'}
          style={{
            marginTop:      '12px',
            padding:        '12px 32px',
            background:     '#c96a7a',
            color:          '#fff',
            borderRadius:   '50px',
            textDecoration: 'none',
            fontSize:       '1rem',
          }}
        >
          Open Gift
        </a>
      </div>
    </>
  );
}
