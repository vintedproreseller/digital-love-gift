import { getGift } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const gift = await getGift(id);
  if (!gift) return Response.json({ error: 'Gift not found' }, { status: 404 });

  if (gift.isPasswordProtected) {
    // Return minimal info — enough for the lock screen and payment gate
    return Response.json({
      id:                 gift.id,
      isPasswordProtected: true,
      isPaid:             gift.isPaid,
      formData: {
        partnerName: gift.formData.partnerName,
        occasion:    gift.formData.occasion,
      },
    });
  }

  const { passwordHash, ...safeGift } = gift;
  return Response.json(safeGift);
}
