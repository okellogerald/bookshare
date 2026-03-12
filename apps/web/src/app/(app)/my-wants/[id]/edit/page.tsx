import { redirect } from "next/navigation";

export default async function MyWantsEditRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/my-wishlist/${id}/edit`);
}
