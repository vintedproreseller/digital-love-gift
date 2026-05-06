/**
 * POST /api/gift/:id/confirm-payment
 * Called client-side after stripe.confirmCardPayment() succeeds.
 * Marks the gift as paid by ID — no body required.
 * The Stripe webhook (payment_intent.succeeded) is the authoritative
 * server-side confirmation; this is a fast-path for the UI redirect.
 */

import { markGiftPaid } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    await markGiftPaid(id, null);
    return Response.json({ success: true });
  } catch (err) {
    console.error('confirm-payment error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
