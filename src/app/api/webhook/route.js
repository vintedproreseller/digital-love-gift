/**
 * POST /api/webhook
 * Stripe webhook receiver — verifies signature, marks gift paid on
 * checkout.session.completed. More reliable than the redirect confirm
 * (handles tab-close / network failure after payment).
 */

import Stripe from 'stripe';
import { markGiftPaid } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Stripe webhook not configured' }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  const sig    = request.headers.get('stripe-signature');

  // Read raw body — App Router doesn't pre-parse, so request.text() is the raw payload
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return Response.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const giftId        = paymentIntent.metadata?.giftId;
    if (giftId) {
      try {
        await markGiftPaid(giftId, paymentIntent.id);
        console.log(`Gift ${giftId} marked as paid via webhook (pi: ${paymentIntent.id})`);
      } catch (err) {
        console.error('markGiftPaid error:', err);
        // Return 500 so Stripe retries the webhook
        return Response.json({ error: 'DB update failed' }, { status: 500 });
      }
    }
  }

  return Response.json({ received: true });
}
