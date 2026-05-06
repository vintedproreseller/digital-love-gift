import { getGift } from '@/lib/db';
import { checkPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { id } = await params;
  const gift = await getGift(id);
  if (!gift) return Response.json({ error: 'Gift not found' }, { status: 404 });

  if (!gift.isPasswordProtected) {
    const { passwordHash, ...safeGift } = gift;
    return Response.json({ success: true, gift: safeGift });
  }

  const { password } = await request.json();
  if (!password) return Response.json({ error: 'Password required' }, { status: 401 });

  if (checkPassword(password, gift.passwordHash)) {
    const { passwordHash, ...safeGift } = gift;
    return Response.json({ success: true, gift: safeGift });
  }

  return Response.json({ error: 'Incorrect password. Try again 💔' }, { status: 401 });
}
