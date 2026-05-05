import { getReactions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const reactions = await getReactions(params.id);
  return Response.json({ reactions });
}
