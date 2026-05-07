/**
 * Next.js Edge Middleware
 *
 * Problem: /gift.html?id=xxx is a static file — no server-side rendering,
 * so OG meta tags are missing when WhatsApp / iMessage / Telegram / Slack
 * fetch that URL to generate a link preview.
 *
 * Fix: Intercept requests from known preview bots and transparently rewrite
 * them to /gift/[id] — our Next.js route that has server-rendered OG meta
 * tags via generateMetadata().  The URL stays the same in the bot's eyes
 * (NextResponse.rewrite), so the bot sees a proper HTML page with OG tags
 * without ever knowing about the rewrite.
 *
 * Real users are NOT rewritten — they get the static file and the full
 * interactive gift experience as normal.
 */

import { NextResponse } from 'next/server';

/** User-agent substrings that belong to link-preview crawlers */
const BOT_PATTERN =
  /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|iframely|embedly|rogerbot|showyoubot|outbrain|quora link preview|vkshare|xing-contenttabreceiver|nuzzel/i;

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  // Only care about /gift.html requests that carry an id param
  if (pathname !== '/gift.html') return NextResponse.next();
  const id = searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.next();

  const ua = request.headers.get('user-agent') || '';

  if (BOT_PATTERN.test(ua)) {
    // Rewrite transparently to the Next.js /gift/[id] page which has
    // server-rendered OG meta tags. The bot never sees a redirect.
    const url = request.nextUrl.clone();
    url.pathname = `/gift/${id}`;
    url.search   = '';           // strip ?id=… from the rewritten URL
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Only run this middleware on /gift.html — nowhere else
  matcher: '/gift.html',
};
