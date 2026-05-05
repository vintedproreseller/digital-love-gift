import { addReaction } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { emoji, message } = await request.json();
  if (!emoji) return Response.json({ error: 'Emoji required' }, { status: 400 });

  const reactions = await addReaction(params.id, emoji, message);
  return Response.json({ success: true, reactions });
}
