// TODO: public profile of another user (their listings, campus, communities)
export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  void id;
  return null;
}
