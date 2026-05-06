/**
 * POST /api/checkout
 * Creates a Stripe PaymentIntent for €5 and returns the client secret.
 * The payment is completed on our own page using Stripe Elements —
 * no redirect to Stripe's hosted checkout.
 */

import Stripe from 'stripe';
import { getGift } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Stripe is not configured' }, { status: 503 });
  }

  let giftId;
  try {
    ({ giftId } = await request.json());
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!giftId) {
    return Response.json({ error: 'giftId is required' }, { status: 400 });
  }

  const gift = await getGift(giftId);
  if (!gift) {
    return Response.json({ error: 'Gift not found' }, { status: 404 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount:      500, // €5.00 in cents
      currency:    'eur',
      description: `Digital Love Gift — unlock for ${gift.formData.partnerName}`,
      metadata:    { giftId },
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe PaymentIntent error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
