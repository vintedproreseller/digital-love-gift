/**
 * POST /api/gift/:id/confirm-payment
 * Called client-side after stripe.confirmCardPayment() succeeds.
 * Verifies the PaymentIntent with Stripe server-side before marking paid —
 * never trusts the client alone.
 */

import Stripe from 'stripe';
import { getGift, markGiftPaid } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { paymentIntentId } = await request.json();
    if (!paymentIntentId) {
      return Response.json({ error: 'paymentIntentId is required' }, { status: 400 });
    }

    const gift = await getGift(params.id);
    if (!gift) {
      return Response.json({ error: 'Gift not found' }, { status: 404 });
    }

    // Already paid (webhook may have arrived first) — idempotent
    if (gift.isPaid) {
      return Response.json({ success: true });
    }

    // Verify with Stripe — don't trust the client's word alone
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return Response.json({ error: 'Payment has not yet succeeded' }, { status: 402 });
    }

    if (paymentIntent.metadata?.giftId !== params.id) {
      return Response.json({ error: 'Payment does not belong to this gift' }, { status: 403 });
    }

    await markGiftPaid(params.id, paymentIntentId);
    return Response.json({ success: true });
  } catch (err) {
    console.error('confirm-payment error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
