import { getGift } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const gift = await getGift(params.id);
  if (!gift) return Response.json({ error: 'Gift not found' }, { status: 404 });

  if (gift.isPasswordProtected) {
    return Response.json({
      id: gift.id,
      isPasswordProtected: true,
      formData: { partnerName: gift.formData.partnerName, occasion: gift.formData.occasion },
    });
  }

  const { passwordHash, ...safeGift } = gift;
  return Response.json(safeGift);
}
