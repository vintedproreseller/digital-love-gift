import { getReactions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const reactions = await getReactions(id);
  return Response.json({ reactions });
}
