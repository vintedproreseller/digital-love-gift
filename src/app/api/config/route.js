/**
 * GET /api/config
 * Returns public (non-secret) config values for the frontend.
 * Only the PUBLISHABLE key is exposed — never the secret key.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    stripePk: process.env.STRIPE_PUBLISHABLE_KEY || null,
  });
}
