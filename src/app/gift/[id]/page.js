import { redirect } from 'next/navigation';

export default function GiftPage({ params }) {
  redirect(`/gift.html?id=${params.id}`);
}
